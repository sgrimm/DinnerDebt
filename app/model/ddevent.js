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
			this.payerId = payer;
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
	payerId: 0,

	/**
	 * Sets the subtotal, adjusting the total accordingly.
	 */
	setSubtotal : function(amount) {
		this.subtotal = amount;
		this.total = this.subtotal + this.getTipAmount();
	},

	/**
	 * Sets the tip percentage, adjusting the total accordingly.
	 */
	setTipPercent : function(percent) {
		this.tipPercent = percent;
		this.total = this.subtotal + this.getTipAmount();
	},

	/**
	 * Sets the total, adjusting the tip percentage (and possibly subtotal) accordingly.
	 */
	setTotal : function(total) {
		this.total = total;
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
	 * Sets the ID of hte payer.
	 */
	setPayerId: function(id) {
		this.payerId = id;
	},
	
	/**
	 * Returns the ID of the payer.
	 */
	getPayerId: function() {
		return this.payerId;
	},
	
	/**
	 * Finds the participation object for a particular user.
	 *
	 * @return int Index of the participation object, or -1 if not found.
	 */
	findParticipationForUser: function(id) {
		// Yeah, linear search
		for (var i = 0; i < this.participations.length; i++) {
			if (this.participations[i].personId == id) {
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
		}

		var part = new Participation(this.id, id);
		this.participations.push(part);
		return part;
	},
	
	/**
	 * Updates the participation object for a particular user, inserting
	 * it into the array if needed.
	 *
	 * @param Participation Model object with updated participation data.
	 */
	setParticipation: function(participation) {
		var index = this.findParticipationForUser(participation.personId);
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
				part.total = 0;
				continue;
			}

Mojo.Log.info('person', part.personId, 'is sharing, additional', part.additionalAmount);
			// Fixed- or additional-price people get a proportional share of the tip.
			var tipShare = Math.round(part.additionalAmount * this.tipPercent / 100.0);
			part.total = part.additionalAmount + tipShare;
			// Don't split the part of the cost covered by fixed-pricers.
			totalToSplit -= part.total;
			if (!part.shareIsFixed) {
				sharerIndexes.push(i);
				numSharers++;
			}
Mojo.Log.info('person', part.personId, 'initial total is', part.total);
		}
Mojo.Log.info('remaining total to split is', totalToSplit, 'among', numSharers);

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
Mojo.Log.info('share for person', part.personId, 'is', share);

			totalToSplit -= share;
			part.total += share;
		}
	},
});


/**
 * List of events in reverse chronological order.
 */
DDEvent.list = null;

DDEvent.list = [
	new DDEvent(1, 'test event 1', 9512, 5, 9988, new Date(2009,4,6,0,0,0,0), [], 1),
	new DDEvent(1, 'test event 1', 9512, 5, 9988, new Date(2009,4,6,0,0,0,0), [], 2),
	new DDEvent(1, 'test event 1', 9512, 5, 9988, new Date(2009,4,6,0,0,0,0), [], 3),
	new DDEvent(1, 'test event 1', 9512, 5, 9988, new Date(2009,4,6,0,0,0,0), [], 1),
	new DDEvent(1, 'test event 1', 9512, 5, 9988, new Date(2009,4,6,0,0,0,0), [], 1),
	new DDEvent(1, 'test event 1', 9512, 5, 9988, new Date(2009,4,6,0,0,0,0), [], 1),
	new DDEvent(1, 'test event 1', 9512, 5, 9988, new Date(2009,4,6,0,0,0,0), [], 1),
	new DDEvent(1, 'test event 1', 9512, 5, 9988, new Date(2009,4,6,0,0,0,0), [], 1),
	new DDEvent(1, 'test event 1', 9512, 5, 9988, new Date(2009,4,6,0,0,0,0), [], 1),
	new DDEvent(1, 'test event 2', 9512, 5, 9988, new Date(2009,4,7,0,0,0,0), [], 1),
	new DDEvent(1, 'test event 3', 9512, 5, 9988, new Date(2009,4,8,0,0,0,0), [], 1),
	new DDEvent(1, 'test event 4', 9512, 5, 9988, new Date(2009,4,9,0,0,0,0), [], 1),
	new DDEvent(1, 'test event 5', 9512, 5, 9988, new Date(2009,4,9,0,0,0,0), [], 1),
];

/**
 * Loads the list of events from the database.
 */
DDEvent.getList = function(onSuccess) {
	if (DDEvent.list != null) {
		onSuccess(DDEvent.list);
		return;
	}

	Mojo.Log.info("loading events");
	depot.get("ddevents",
			function(obj) {
				if (obj == null) {
					// Newly-created DB
					Mojo.Log.info("Event list not found, creating");
					DDEvent.list = [];
				} else {
					DDEvent.list = obj;
				}
				onSuccess(DDEvent.list);
			},
			function(error) { "Can't load events, code " + error; });
}

/**
 * Saves the list of events to the database.
 */
DDEvent.saveList = function() {
	depot.add("ddevents", DDEvent.list,
			function() {},
			function(error) { throw "Can't save events, error " + error; });
}

/**
 * Sorts the list in reverse chronological order.
 */
DDEvent.sortList = function() {
	DDEvent.list.sort(function(a,b) { return b.date.getTime() - a.date.getTime(); });
}

DDEvent.sortList();
