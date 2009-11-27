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
	 * Returns true if this is an "interesting" event (i.e., it's worth
	 * saving.)
	 */
	isWorthKeeping: function() {
		return this.id != 0 || this.total != 0 || this.description;
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
	save: function(tx, onSuccess) {
		if (! tx) {
			return db.transaction(function(tx) {
					this.save(tx, onSuccess);
				}.bind(this));
		}
		if (this.id != 0) {
			this.removeFromList();
		} else {
			this.id = DDEvent.getUnusedId();
		}

		this.insertIntoList();

		var keep = this.isWorthKeeping();

		// If we've loaded the participations array, save it; otherwise
		// leave it as is.
		if (this.participations != null) {
			for (var i = 0; i < this.participations.length; i++) {
				this.participations[i].save(tx);
			}
		}

		tx.executeSql(
			'INSERT OR REPLACE' +
				' INTO ddevent (id, description, subtotal, tip_percent,' +
								' total, date, payer_id)' +
				' VALUES (?,?,?,?,?,?,?)',
			[this.id, this.description, this.subtotal, this.tipPercent,
			 this.total, Math.floor(this.date.getTime() / 1000),
			 this.payer ? this.payer.id : null],
			Person.saveList.curry(tx, onSuccess),
			DBUtil.logFailure
		);
	},

	/**
	 * Loads any data that aren't present in the initial list of events.
	 *
	 * @param callback  Called with this object as a parameter when the
	 *                  loading is complete.
	 */
	load: function(callback) {
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

	/**
	 * Deletes the current event from the list, undoing all its effects on
	 * people's balances.
	 */
	doDelete: function(onSuccess) {
		if (this.id == 0) {
			// Not saved yet = nothing to delete
			return;
		}

		this.removeFromList();

		db.transaction(function(tx) {
			if (this.participations != null) {
				for (var i = 0; i < this.participations.length; i++) {
					this.participations[i].setTotal(0);
					this.participations[i].isSharing = false;
					this.participations[i].save(tx);
				}
			}

			tx.executeSql(
				'DELETE FROM ddevent WHERE id = ?',
				[this.id],
				function(tx) {
					this.id = 0;
					this.setTotal(0);	// this will also debit the payer
					this.description = null;
					Person.saveList(tx, onSuccess);
				}.bind(this),
				DBUtil.logFailure
			);
		}.bind(this));
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

	db.transaction(function(tx) {
		tx.executeSql(
			'SELECT id, description, subtotal, tip_percent,' +
					' total, date, payer_id' +
				' FROM ddevent' +
				' ORDER BY date ASC',
			[],
			function(tx, result) {
				DDEvent.list = [];
				for (var i = 0; i < result.rows.length; i++) {
					var row = result.rows.item(i);
					DDEvent.list.push(new DDEvent(
						row.id, row.description, row.subtotal,
						row.tip_percent, row.total,
						new Date(row.date * 1000), null,
						Person.get(row.payer_id)));
				}

				onSuccess(DDEvent.list);
			},
			DBUtil.logFailure
		);
	});
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

/**
 * Migrates event records from the old depot format. Called by
 * DBUtil.updateSchema().
 */
DDEvent.migrateFromDepot = function(tx, onSuccess, onFailure) {
	var list = DDEvent.list;

	if (list != null) {
		var saveEventFromList = function(num) {
			if (num < list.length) {
				list[num].save(tx, saveEventFromList.curry(num + 1));
			} else {
				DDEvent.list = null;
				if (onSuccess) {
					onSuccess(tx);
				}
			}
		};

		saveEventFromList(0);
	} else {
		if (onSuccess) {
			onSuccess(tx);
		}
	}
}

DDEvent.migrateFromDepot.prepare = function(onSuccess, onFailure) {
	depot.get("ddevents",
			function(list) {
				DDEvent.list = [];

				if (list != null) {
					list.each(function(e) {
						// Fix up broken events from data entry bug
						if (isNaN(e.subtotal)) {
							e.subtotal = 0;
						}
						if (isNaN(e.tipPercent)) {
							e.tipPercent = 0;
						}
						if (isNaN(e.total)) {
							e.total = 0;
						}

						DDEvent.list.push(
							new DDEvent(e.id, e.description,
										e.subtotal, e.tipPercent, e.total,
										new Date(e.date),
										null,
										// a fake Person just for the id
										new Person(e.payerId)));
					});
				}

				onSuccess();
			},
			function(error) {
				Mojo.Log.error("Can't load events, code " + error);
				onFailure();
			});
}
