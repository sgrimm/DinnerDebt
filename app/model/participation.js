/**
 * A single user's participation in an event.
 */
var Participation = Class.create({
	/** Person who participated. */
	person: null,

	/** DDEvent participated in. */
	ddEvent: null,

	/** True if this person shared the expense. */
	isSharing: false,

	/**
	 * True if this person's price is fixed rather than relative to an even share.
	 * If this is set, "share" should be zero. 
	 */
	shareIsFixed: false,

	/** Additional pre-tip amount above and beyond the person's share. */
	additionalAmount: 0,

	/** Total share with tip included, in cents. */
	total: 0,

	initialize: function(person, ddEvent, isSharing,
						 shareIsFixed, additionalAmount, total) {
		if (! person) {
			throw "Person object is required for Participation";
		}
		if (! ddEvent) {
			throw "DDEvent object is required for Participation";
		}
		this.person = person;
		this.ddEvent = ddEvent;
		this.isSharing = isSharing ? isSharing : false;
		this.shareIsFixed = shareIsFixed ? shareIsFixed : false;
		this.additionalAmount = additionalAmount ? additionalAmount : 0;
		this.total = total ? total : 0;
	},

	/** Returns this participation's total amount. */
	getTotal: function() {
		return this.total;
	},

	/**
	 * Updates this participation's total amount, adjusting the balance of the
	 * person involved.
	 */
	setTotal: function(newTotal) {
		this.person.credit(this.total);
		this.person.debit(newTotal);
		this.total = newTotal;
	},

	/**
	 * Saves this participation to the database.
	 *
	 * @param tx   Transaction object as passed to DB transaction
	 *             callbacks.
	 */
	save: function(tx, onSuccess, onFailure) {
		if (! tx) {
			throw "No transaction supplied to Participation.save";
		}

		if (this.isWorthKeeping()) {
			tx.executeSql(
				'INSERT OR REPLACE INTO participation (' +
						'personId, eventId, isSharing, shareIsFixed,' +
						' additionalAmount, total' +
					') VALUES (' +
						'?,?,?,?,?,?' +
					')',
				[this.person.id, this.ddEvent.id, this.isSharing,
				 this.shareIsFixed, this.additionalAmount, this.total],
				function(tx, result) {
					this.id = result.insertID;
					if (onSuccess) {
						onSuccess();
					}
				}.bind(this),
				onFailure ? onFailure : DBUtil.logFailure);
		} else {
			tx.executeSql(
				'DELETE FROM participation' +
					' WHERE personId = ?' +
					' AND eventId = ?',
				[this.person.id, this.ddEvent.id],
				function(tx, result) {
					if (onSuccess) {
						onSuccess();
					}
				},
				onFailure ? onFailure : DBUtil.logFailure);
		}
	},

	/** Returns true if this participation has any data worth keeping. */
	isWorthKeeping: function() {
		return this.isSharing || (this.total != 0);
	},

});

/**
 * Unpacks a simple-object version of this participation.
 */
Participation.complexify = function(obj) {
	return new Participation(
			Person.get(obj.personId),
			DDEvent.getRaw(obj.ddEventId),
			obj.isSharing,
			obj.shareIsFixed,
			obj.additionalAmount,
			obj.total,
			obj.id);
}

/**
 * Fetches the participation data for a particular event.
 */
Participation.getForEvent = function(ddEvent, onSuccess, onFailure) {
	if (! ddEvent || ! onSuccess) {
		throw "Required parameter missing in Participation.getByEvent";
	}

	db.transaction(function(tx) {
		tx.executeSql(
			'SELECT personId, eventId, isSharing, shareIsFixed,' +
					' additionalAmount, total' +
				' FROM participation' +
				' WHERE eventId = ?',
			[ddEvent.id],
			function(tx, result) {
				var list = [];
				for (var i = 0; i < result.rows.length; i++) {
					var row = result.rows.item(i);
					var part = new Participation(
										Person.get(row.personId),
										ddEvent,
										row.isSharing,
										row.shareIsFixed,
										row.additionalAmount,
										row.total);
					list.push(part);
				}

				onSuccess(list);
			},
			onFailure ? onFailure : DBUtil.logFailure);
		});
}

/**
 * Sets up the database; this is called at app startup time.
 */
Participation.setupDB = function(tx, callback) {
	tx.executeSql(
		'CREATE TABLE IF NOT EXISTS participation (' +
			'personId INTEGER NOT NULL,' +
			'eventId INTEGER NOT NULL,' +
			'isSharing INTEGER NOT NULL,' +
			'shareIsFixed INTEGER NOT NULL,' +
			'additionalAmount INTEGER NOT NULL,' +
			'total INTEGER NOT NULL,' +
			'PRIMARY KEY (eventId, personId)' +
		')',
		[],
		function(tx, resultSet) {
			tx.executeSql(
				'CREATE INDEX IF NOT EXISTS participation_i_event' +
					' ON participation (personId)',
				[],
				function(tx, resultSet) {
					callback();
				},
				function(tx, error) {
					Mojo.Log.error("Can't create participation index", error);
					throw error;
				});
		},
		DBUtil.logFailure);
}
