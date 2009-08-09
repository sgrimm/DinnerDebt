/**
 * A single person's private data.
 */
var Person = Class.create({
	initialize : function(id, name, balance) {
		this.id = id;
		this.name = name;
		this.balance = balance;
	},

	/**
	 * A unique identifier for the person.
	 */
	id : 0,
	
	/**
	 * The person's name.
	 * TODO: link to contact entry
	 */
	name : '',

	/**
	 * Money owed to or by the group. This is like a bank balance, not a credit card balance;
	 * a positive value is a credit (the group owes this person money). This balance is an
	 * integer number of cents.
	 */
	balance : 0,

	/**
	 * Adds credit to a person's balance.
	 */
	credit : function(amount) {
		if (amount < 0) {
			throw "Can't credit negative values";
		}
		this.balance += amount;
	},

	/**
	 * Withdraws money from a person's balance.
	 */
	debit : function(amount) {
		if (amount < 0) {
			throw "Can't debit negative values";
		}
		this.balance -= amount;
	},
	
	/**
	 * Adds this person to the person list.
	 */
	add : function() {
		if (! this.id) {
			this.id = Person.getUnusedId();
			Person.list[this.id] = this;
			Person.saveList();
			Person.visibleCount++;
		}
		// else we were already on the list
	},
});

/**
 * List of people, indexed by ID.
 */
Person.list = null;

/**
 * Number of visible people in list.
 */
Person.visibleCount = 0;

/** Sort list by name */
Person.SORT_NAME = 0;

/** Sort list by balance */
Person.SORT_BALANCE = 1;

/**
 * Loads the list of people from the database.
 * 
 * @param sortStyle Person.SORT_NAME or Person.SORT_BALANCE
 */
Person.getList = function(sortStyle, onSuccess) {
	if (Person.list != null) {
		var list = [];
		for (var id in Person.list) {
			list.push(Person.list[id]);
		}
		list.sort(function(a,b) {
			if (sortStyle == Person.SORT_NAME) {
				if (a.name < b.name) {
					return -1;
				}
				else if (b.name < a.name) {
					return 1;
				}
				else {
					return a.balance - b.balance;
				}
			}
			else {
				if (a.balance != b.balance) {
					return a.balance - b.balance;
				} else if (b.name < a.name) {
					return 1;
				} else if (a.name > b.name) {
					return -1;
				} else {
					return 0;
				}
			}
		});

		onSuccess(list);
		return;
	}

	Mojo.Log.info("loading people");
	depot.get("people",
			function(list) {
				Person.list = {};
				if (list == null) {
					Mojo.Log.info("People list not found, creating");
				} else {
					for (var id in list) {
						var entry = list[id];
						Person.list[id] = new Person(id, entry.name, entry.balance);
						Person.visibleCount++;
					}
				}
				Person.getList(sortStyle, onSuccess);
			},
			function(error) { throw "Can't load people, code " + error; });
}

/**
 * Saves the list of people to the database.
 */
Person.saveList = function() {
	// Person objects will be saved as dumb JSON objects and will
	// be reconstituted into proper objects at load time.
	depot.add("people", Person.list,
			function() {},
			function(error) { throw "Can't save people, code " + error; });
}

/**
 * Returns a person with a particular ID.
 * @param int id
 */
Person.get = function(id){
	if (Person.list[id]) {
		return Person.list[id];
	} else {
		Mojo.Log.error("Can't find person with id", id);
		return null;
	}
}

/**
 * Returns an unused ID number.
 */
Person.getUnusedId = function() {
	var maxId = 0;
	for (var id in Person.list) {
		if (id > maxId) {
			maxId = id;
		}
	}

	return maxId + 1;
}

/**
 * Returns the number of visible people in the database.
 */
Person.getCount = function(onSuccess) {
	onSuccess(Person.visibleCount);
}
