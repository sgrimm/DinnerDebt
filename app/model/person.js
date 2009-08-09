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
});

/**
 * List of people, indexed by ID.
 */
Person.list = {
	1 : new Person(1, 'Steve', -10000),
	2 : new Person(2, 'Julie', 0),
	3 : new Person(3, 'John', 5505),
	4 : new Person(4, 'Yu-Ting', 0),
	5 : new Person(5, 'Mike', 3495),
	6 : new Person(6, 'Shelley', 2008),
	7 : new Person(7, 'Eric', -1008),
};

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
					return 0;
				}
			}
			else {
				return a.balance - b.balance;
			}
		});

		onSuccess(list);
		return;
	}

	Mojo.Log.info("loading people");
	depot.get("people",
			function(obj) {
				if (obj == null) {
					// Newly-created DB
					Mojo.Log.info("People list not found, creating");
					Person.list = {};
				} else {
					Person.list = obj;
				}
				Person.getList(sortStyle, onSuccess);
			},
			function(error) { throw "Can't load people, code " + error; });
}

/**
 * Saves the list of people to the database.
 */
Person.saveList = function() {
	depot.add("people", people,
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
