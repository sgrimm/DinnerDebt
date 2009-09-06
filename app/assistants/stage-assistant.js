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
		db = openDatabase("ext:dinnerdebt", 1, "DinnerDebt", 100000);

		// Create all the tables if they don't exist.
		db.transaction(function(transaction) {
			Participation.setupDB(transaction, function() {
				Person.setupDB(transaction, function() {
					// Do more DB setup here...
					callback();
				});
			});
		});
	},

});
