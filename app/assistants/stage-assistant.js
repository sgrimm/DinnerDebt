/**
 * Handler for the main application stage (card / window).
 */
var StageAssistant = Class.create({
	initialize : function() {
		this.depotSetupDone = this.depotSetupDone.bind(this);
		this.dbSetupDone = this.dbSetupDone.bind(this);

		this.personSortOrder = new Mojo.Model.Cookie('personSortOrder').get();
		if (!this.personSortOrder) {
			this.personSortOrder = Person.SORT_NAME;
		}
	},

	/**
	 * Starts the chain of setup operations rolling. Since we're calling
	 * asynchronous APIs here, this is organized as a series of callback
	 * methods, the last of which does the actual scene push that brings
	 * the user to the DinnerDebt UI.
	 */
	setup : function() {
		this.openDepot(this.depotSetupDone);
	},

	depotSetupDone: function() {
		this.openDB(this.dbSetupDone);
	},

	dbSetupDone: function() {
		// Load the people list, which we need for loading other stuff.
		Person.getList(Person.SORT_NAME, function() {
				// Show the initial scene.
				this.controller.pushScene('events', this);
			}.bind(this));
	},

	/**
	 * Updates the current sort order of the person list, which is shared
	 * across several different scenes.
	 */
	setPersonSortOrder: function(newOrder) {
		this.personSortOrder = newOrder;
		new Mojo.Model.Cookie('personSortOrder').put(newOrder);
	},

	openDepot: function(callback) {
		// Global
		depot = new Mojo.Depot(
			{
				name: 'dinnerdebt',
				version: 1,
				displayName: 'DinnerDebt Data',
				estimatedSize: 10000
			},
			callback,
			function(error) {
				throw "Can't create data store (code " + error + ")";
			}
		);
	},

	openDB: function(callback) {
		/**
		 * Schema setup. DO NOT DELETE ENTRIES FROM THIS as the DB utility
		 * code stores the most recently played array index in a DB table.
		 */
		var operations = [

			'CREATE TABLE IF NOT EXISTS participation (' +
				'personId INTEGER NOT NULL,' +
				'eventId INTEGER NOT NULL,' +
				'isSharing INTEGER NOT NULL,' +
				'shareIsFixed INTEGER NOT NULL,' +
				'additionalAmount INTEGER NOT NULL,' +
				'total INTEGER NOT NULL,' +
				'PRIMARY KEY (eventId, personId)' +
			')',

			'CREATE INDEX IF NOT EXISTS participation_i_event' +
				' ON participation (personId)',

			'CREATE TABLE IF NOT EXISTS person (' +
				' id INTEGER,' +
				' name TEXT,' +
				' balance INTEGER,' +
				' position INTEGER,' +
				' visible INTEGER,' +
				' PRIMARY KEY (id)' +
			')',

			Person.migrateFromDepot,

			'CREATE TABLE IF NOT EXISTS ddevent (' +
				' id INT,' +
				' description TEXT,' +
				' subtotal INT,' +
				' tip_percent REAL,' +
				' total INT,' +
				' date NUMERIC,' +
				' payer_id REFERENCES person (id),' +
				' PRIMARY KEY (id)' +
			')',

			// For efficient sorting by date
			'CREATE INDEX IF NOT EXISTS ddevent_i_date' +
				' ON ddevent (date)',

			DDEvent.migrateFromDepot,

		];

		db = openDatabase("ext:dinnerdebt", 1, "DinnerDebt", 100000);

		// Create all the tables if they don't exist.
		DBUtil.updateSchema(db, operations, callback,
			function(errorMessage) {
				Mojo.Log.error("Schema update failed:", errorMessage);
				// Don't call the success callback
			}
		);
	},

	handleCommand: function(event) {
		if (event.type == Mojo.Event.command) {
			switch (event.command) {
			case 'help':
				this.controller.pushAppSupportInfoScene();
				break;
			}
		}
	},
});
