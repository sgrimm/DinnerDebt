/**
 * Handler for the main application stage (card / window).
 */
var StageAssistant = Class.create({
	initialize : function() {
		// Pull stored data from the DB.
		openDB();

		this.personSortOrder = new Mojo.Model.Cookie('personSortOrder').get();
		if (!this.personSortOrder) {
			this.personSortOrder = Person.SORT_NAME;
		}
	},

	setup : function() {
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
});

function openDB() {
	// Global
	depot = new Mojo.Depot(
		{
			name: 'dinnerdebt',
			version: 1,
			displayName: 'DinnerDebt Data',
			estimatedSize: 10000
		},
		function() {},
		function(error) { throw "Can't create data store (code " + error + ")"; }
	);

	Mojo.Log.info("Opened database");
}
