/**
 * Data about a particular event. We call this a "DDEvent" to avoid name conflicts
 * with Mojo's DOM events.
 */
var DDEvent = Class.create({
	initialize: function(id, description, subtotal, tipPercent, total, date, parts) {
		if (id) {
			this.id = id;
			this.description = description;
			this.subtotal = subtotal;
			this.tipPercent = tipPercent;
			this.total = total;
			this.date = date;
			this.participations = parts;
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
	 * Event participation records. (EventParticipation object array)
	 */
	participations : [],

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
});


/**
 * List of events in reverse chronological order.
 */
DDEvent.list = null;

DDEvent.list = [
	new DDEvent(1, 'test event 1', 9512, 5, 9988, new Date(2009,4,6,0,0,0,0), []),
	new DDEvent(1, 'test event 1', 9512, 5, 9988, new Date(2009,4,6,0,0,0,0), []),
	new DDEvent(1, 'test event 1', 9512, 5, 9988, new Date(2009,4,6,0,0,0,0), []),
	new DDEvent(1, 'test event 1', 9512, 5, 9988, new Date(2009,4,6,0,0,0,0), []),
	new DDEvent(1, 'test event 1', 9512, 5, 9988, new Date(2009,4,6,0,0,0,0), []),
	new DDEvent(1, 'test event 1', 9512, 5, 9988, new Date(2009,4,6,0,0,0,0), []),
	new DDEvent(1, 'test event 1', 9512, 5, 9988, new Date(2009,4,6,0,0,0,0), []),
	new DDEvent(1, 'test event 1', 9512, 5, 9988, new Date(2009,4,6,0,0,0,0), []),
	new DDEvent(1, 'test event 1', 9512, 5, 9988, new Date(2009,4,6,0,0,0,0), []),
	new DDEvent(1, 'test event 2', 9512, 5, 9988, new Date(2009,4,7,0,0,0,0), []),
	new DDEvent(1, 'test event 3', 9512, 5, 9988, new Date(2009,4,8,0,0,0,0), []),
	new DDEvent(1, 'test event 4', 9512, 5, 9988, new Date(2009,4,9,0,0,0,0), []),
	new DDEvent(1, 'test event 5', 9512, 5, 9988, new Date(2009,4,9,0,0,0,0), []),
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
