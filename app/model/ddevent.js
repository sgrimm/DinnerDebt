/**
 * Data about a particular event. We call this a "DDEvent" to avoid name conflicts
 * with Mojo's DOM events.
 */
var DDEvent = Class.create({
	initialize: function(id, description, subtotal, tipPercent, total, date, parts, payer) {
		if (id) {
			this.id = id;
			this.description = description;
			this.subtotal = subtotal;
			this.tipPercent = tipPercent;
			this.total = total;
			this.date = date;
			this.participations = parts;
			this.payer = payer;
		} else {
			this.participations = [];	// otherwise we'll reference the prototype's array
			this.date = new Date();
		}
	},

	/**
	 * A unique identifier for the event.
	 */
	id : 0,

	/**
	 * Description of the event.
	 */
	description : '',

	/**
	 * Subtotal (cost before tip). This amount is in cents.
	 */
	subtotal : 0,

	/**
	 * Tip percentage.
	 */
	tipPercent : 0,
	
	/**
	 * Total cost with tip.
	 */
	total : 0,
	
	/**
	 * When the event happened. (JS Date object)
	 */
	date : null,
	
	/**
	 * Event participation records. (Participation object array)
	 */
	participations : [],

	/**
	 * ID of person who paid the bill.
	 */
	payer: null,

	/**
	 * Sets the subtotal, adjusting the total accordingly.
	 */
	setSubtotal : function(amount) {
		this.subtotal = amount;
		this._setTotal(this.subtotal + this.getTipAmount());
	},

	/**
	 * Sets the tip percentage, adjusting the total accordingly.
	 */
	setTipPercent : function(percent) {
		this.tipPercent = percent;
		this._setTotal(this.subtotal + this.getTipAmount());
	},

	/**
	 * Sets the total, adjusting the tip percentage (and possibly subtotal) accordingly.
	 */
	setTotal : function(total) {
		this._setTotal(total);
		if (!this.subtotal) {
			if (!this.tipPercent) {
				// No tip, no subtotal: set subtotal to total
				this.subtotal = this.total;
			} else {
				// Tip, no subtotal: set subtotal to total minus tip
				this.subtotal = this.total / ((this.tipPercent + 100) / 100.0);
			}
		} else {
			// Subtotal: set tip percentage, overriding existing value if any
			this.tipPercent = ((this.total / this.subtotal) * 100) - 100;
		}
	},
	
	/**
	 * Sets the raw total, adjusting the payer's balance. Internal only.
	 */
	_setTotal : function(newTotal) {
		if (this.payer) {
			this.payer.debit(this.total);
			this.payer.credit(newTotal);
		}
		this.total = newTotal;
	},

	/**
	 * Returns the subtotal in cents.
	 */
	getSubtotal : function() {
		return this.subtotal;
	},

	/**
	 * Returns the total in cents.
	 */	
	getTotal: function() {
		return this.total;
	},
	
	/**
	 * Returns the tip percentage.
	 */
	getTipPercent: function() {
		return this.tipPercent;
	},

	/**
	 * Returns the tip amount in cents.
	 */	
	getTipAmount: function() {
		if (this.subtotal == 0 || this.tipPercent == 0) {
			return 0;
		}
		return Math.round((this.subtotal * this.tipPercent) / 100.0);
	},

	/**
	 * Sets the payer.
	 */
	setPayer: function(person) {
		if (this.payer) {
			this.payer.debit(this.total);
		}
		this.payer = person;
		if (this.payer) {
			this.payer.credit(this.total);
		}
	},
	
	/**
	 * Returns the payer.
	 */
	getPayer: function() {
		return this.payer;
	},

	/**
	 * Returns the payer's ID.
	 */
	getPayerId: function() {
		return this.payer ? this.payer.id : 0;
	},
	
	/**
	 * Sets the payer by ID.
	 */
	setPayerId: function(id) {
		this.setPayer(id ? Person.get(id) : null);
	},

	/**
	 * Finds the participation object for a particular user.
	 *
	 * @return int Index of the participation object, or -1 if not found.
	 */
	findParticipationForUser: function(id) {
		// Yeah, linear search
		for (var i = 0; i < this.participations.length; i++) {
			if (this.participations[i].person.id == id) {
				return i;
			}
		}
		return -1;
	},
	
	/**
	 * Returns the participation object for a particular user, inserting
	 * it into the array if needed. We'll strip inactive ones out at
	 * save time.
	 */
	getParticipationForUser: function(id) {
		var index = this.findParticipationForUser(id);
		if (index > -1) {
			return this.participations[index];
		} else {
			var part = new Participation(Person.get(id), this);
			this.participations.push(part);
			return part;
		}
	},
	
	/**
	 * Updates the participation object for a particular user, inserting
	 * it into the array if needed.
	 *
	 * @param Participation Model object with updated participation data.
	 */
	setParticipation: function(participation) {
		var index = this.findParticipationForUser(participation.person.id);
		if (index == -1) {
			this.participations.push(participation);
		} else if (this.participations[index] !== participation) {
			this.participations[index] = participation;
		}
		
		this.recalculateShares();
	},

	/**
	 * Recalculates users' shares based on the participation models.
	 */
	recalculateShares: function() {
		var numSharers = 0;
		var totalToSplit = this.getTotal();
		var sharerIndexes = [];

		// First figure out how many people are sharing the expense.
		// Subtract any fixed-price amounts from the total to be
		// shared.
		for (var i = 0; i < this.participations.length; i++) {
			var part = this.participations[i];

			if (!part.isSharing) {
				part.setTotal(0);
				continue;
			}

			// Fixed- or additional-price people get a proportional share of the tip.
			var tipShare = Math.round(part.additionalAmount * this.tipPercent / 100.0);
			part.setTotal(part.additionalAmount + tipShare);
			// Don't split the part of the cost covered by fixed-pricers.
			totalToSplit -= part.getTotal();
			if (!part.shareIsFixed) {
				sharerIndexes.push(i);
				numSharers++;
			}
		}

		// At this point:
		// - totalToSplit has the total (with tip) minus any additional or
		//   fixed amounts (with tip)
		// - each participation's total is set to that person's fixed-cost
		//   amount (with tip) which is zero for equal-share people

		if (totalToSplit < 0) {
			// XXX - adjust real subtotal? show error?
		} else while (numSharers > 0) {
			// Distribute the remaining subtotal among participants.
			// Since there might be fractional cents, do this by iteratively
			// divvying up the remaining total among the remaining people,
			// such that any excess will be spread among everyone.
			var share = Math.round(totalToSplit / numSharers);
			numSharers--;
			var part = this.participations[sharerIndexes[numSharers]];

			totalToSplit -= share;
			part.setTotal(part.getTotal() + share);
		}
	},

	/**
	 * Inserts this event into the event list in the appropriate position
	 * based on its date.
	 */
	insertIntoList: function() {
		// Inserting at end of list is vastly more common than inserting
		// into the middle somewhere.
		if (DDEvent.list.length == 0) {
			DDEvent.list.push(this);
		} else {
			var myDate = this.date.getTime();
			var i = DDEvent.list.length - 1;
			while (i > -1) {
				var e = DDEvent.list[i];
				var hisDate = e.date.getTime();
				if (e.id == this.id) {
					return;
				}
				if (hisDate < myDate || hisDate == myDate && e.id < this.id) {
					break;
				}

				i--;
			}
			Mojo.Log.info("insert at pos:",i+1,this.id,this.date.toString());
			DDEvent.list.splice(i + 1, 0, this);
		}
	},

	/**
	 * Removes this event from the event list.
	 */
	removeFromList: function() {
		if (this.id == 0) {
			return;
		}

		// Not elegant, but we're unlikely to be removing tons of historical
		// events, so in the common case this will tend to be as fast as or
		// faster than binary searching.
		for (var i = DDEvent.list.length - 1; i >= 0; i--) {
			if (DDEvent.list[i].id == this.id) {
				DDEvent.list.splice(i, 1);
				return;
			}
		}

		Mojo.Log.error("Can't remove event id", this.id, "from list");
	},

	/**
	 * Saves this event to the database.
	 */
	save : function() {
		if (this.id != 0) {
			this.removeFromList();
		} else {
			this.id = DDEvent.getUnusedId();
		}
		this.insertIntoList();

		// else we were editing the existing list item in place anyway

		db.transaction(function(tx) {
			for (var i = 0; i < this.participations.length; i++) {
				this.participations[i].save(tx);
			}
		}.bind(this));

		DDEvent.saveList();
		Person.saveList();
	},

	/**
	 * Loads any data that aren't present in the initial list of events.
	 *
	 * @param callback  Called with this object as a parameter when the
	 *                  loading is complete.
	 */
	load : function(callback) {
		if (this.participations) {
			// Already loaded; nothing to do.
			callback(this);
		} else {
			Participation.getForEvent(this,
				function(participations) {
					this.participations = participations;
					callback(this);
				}.bind(this));
		}
	},

});


/**
 * List of events in reverse chronological order.
 */
DDEvent.list = null;

/**
 * Loads the list of events from the database.
 */
DDEvent.getList = function(onSuccess) {
	if (DDEvent.list != null) {
		onSuccess(DDEvent.list);
		return;
	}

	depot.get("ddevents",
			function(list) {
				DDEvent.list = [];
				if (list != null) {
					db.transaction(function(tx) {
						for (var i = 0; i < list.length; i++) {
							var e = list[i];
							new DDEvent(e.id, e.description,
										  e.subtotal, e.tipPercent, e.total,
										  new Date(e.date),
										  null,
										  Person.get(e.payerId))
									.insertIntoList();

							// Migrate participations list from legacy records
							// XXX - remove this at some point
							if (e.participations) {
								e.participations.each(function(sp) {
									Participation.complexify(sp).save(tx);
								});
							}
						}
					});
					DDEvent.list = obj;
				}
				onSuccess(DDEvent.list);
			},
			function(error) { "Can't load events, code " + error; });
}

/**
 * Gets the length of the list of events from the database.
 *
 * @param onSuccess  Function to call with a length.
 */
DDEvent.getListLength = function(onSuccess) {
	onSuccess(DDEvent.list.length);
}

/**
 * Saves the list of events to the database.
 */
DDEvent.saveList = function() {
	// Need to convert the list to a serializable form, i.e.,
	// a list of name-value-pair lists with no complex values.
	var serializable = [];
	for (var i = 0; i < DDEvent.list.length; i++) {
		var e = DDEvent.list[i];

		serializable.push({
			id: e.id,
			description: e.description,
			subtotal: e.subtotal,
			tipPercent: e.tipPercent,
			// XXX - could derive the total at load time
			total: e.total,
			date: e.date.getTime(),
			payerId: e.payer ? e.payer.id : null,
		});
	}

	depot.add("ddevents", serializable,
			function() {},
			function(error) { throw "Can't save events, error " + error; });
}

/**
 * Allocates a new ID to an event.
 */
DDEvent.getUnusedId = function() {
	var maxId = 0;
	for (var i = 0; i < DDEvent.list.length; i++) {
		if (DDEvent.list[i].id > maxId) {
			maxId = DDEvent.list[i].id;
		}
	}
	return maxId + 1;
}

/**
 * Sorts the list in reverse chronological order.
 */
DDEvent.sortList = function() {
	DDEvent.list.sort(function(a,b) { return b.date.getTime() - a.date.getTime(); });
}

/**
 * Returns the raw event object for a particular ID, without attempting to
 * initialize its contents.
 *
 * XXX - should build an index of events so we don't have to linear-search
 */
DDEvent.getRaw = function(id) {
	for (var i = DDEvent.list.length - 1; i >= 0; i--) {
		if (DDEvent.list[i].id == id) {
			return DDEvent.list[i];
		}
	}
	return null;
}
