/**
 * A single person's private data.
 */
var Person = Class.create({
	initialize : function(id, name, balance, position, visible) {
		this.id = id;
		this.name = name;
		this.balance = balance;
		this.position = position;
		this.visible = visible ? true : false;
	},

	/** A unique identifier for the person. */
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

	/** Position in the manually-sorted list. */
	position : 0,

	/** Is this person visible in the list? */
	visible: false,

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
			this.position = Person.getNextPosition();
			Person.list[this.id] = this;
			Person.saveList();
			Person.visibleCount++;
		}
		// else we were already on the list
	},

	/**
	 * Saves this person to the database.
	 */
	save: function(onSuccess, onFailure, tx) {
		if (! tx) {
			return db.transaction(this.save.bind(this, onSuccess, onFailure));
		}

		tx.executeSql(
			'INSERT OR REPLACE' +
				' INTO person (id, name, balance, position, visible)' +
				' VALUES (?,?,?,?,?)',
			[this.id, this.name, this.balance, this.position,
			 this.visible ? 1 : 0],
			onSuccess,
			onFailure);
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

/** Sort list by manual ordering */
Person.SORT_MANUAL = 2;

/**
 * Returns a sorted copy of the person list. (Internal only.)
 */
Person._sortList = function(sortStyle) {
	if (Person.list != null) {
		var list = [];
		for (var id in Person.list) {
			// Migrate old positionless people
			if (!Person.list[id].position) {
				Person.list[id].position =
					Person.getNextPosition();
			}
			list.push(Person.list[id]);
		}
		list.sort(function(a,b) {
			switch (sortStyle) {
			case Person.SORT_NAME:
				if (a.name < b.name) {
					return -1;
				}
				else if (b.name < a.name) {
					return 1;
				}
				else {
					return a.balance - b.balance;
				}

			case Person.SORT_BALANCE:
				if (a.balance != b.balance) {
					return a.balance - b.balance;
				} else if (b.name < a.name) {
					return 1;
				} else if (b.name > a.name) {
					return -1;
				} else {
					return 0;
				}

			default:
				// Positions are never equal
				if (a.position == b.position) {
					throw "Positions can't be equal!";
				}
				return a.position - b.position;
			}

		});

		return list;
	} else {
		throw "Can't sort list before loading it";
	}
}

/**
 * Loads the list of people from the database.
 * 
 * @param sortStyle Person.SORT_NAME or Person.SORT_BALANCE
 */
Person.getList = function(sortStyle, onSuccess) {
	if (Person.list != null) {
		var list = Person._sortList(sortStyle);
		onSuccess(list);
		return;
	}

	db.transaction(function(tx) {
		tx.executeSql(
			'SELECT id, name, balance, position, visible' +
				' FROM person',
			[],
			function(tx, result) {
				if (result.rows.length == 0) {
					Person.getListFromDepot(sortStyle, function(list) {
						Person.saveList();
						return onSuccess(list);
					});
				}

				Person.list = {};
				for (var i = 0; i < result.rows.length; i++) {
					var row = result.rows.item(i);
					Person.list[row.id] = new Person(row.id, row.name,
													row.balance, row.position,
													row.visible);
				}
				var list = Person._sortList(sortStyle);
				onSuccess(list);
			},
			DBUtil.logFailure);
	});
}

/**
 * Migrates the list of people from the old depot format.
 */
Person.getListFromDepot = function(sortStyle, onSuccess) {
	depot.get("people",
			function(list) {
				Person.list = {};
				if (list == null) {
					Mojo.Log.info("People list not found, creating");
				} else {
					for (var id in list) {
						var entry = list[id];
						Person.list[id] = new Person(id, entry.name,
												entry.balance, entry.position,
												true);
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
	db.transaction(function(tx) {
		try {
			for (var id in Person.list) {
				var person = Person.list[id];
				person.save(
					function() {
						// success, no action required
					},
					DBUtil.logFailure,
					tx);
			}
		}
		catch (e) {
			Mojo.Log.error(e);
		}
	});
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

	return 1 + (maxId * 2) / 2;	// maxId may be a string, so this forces a cast
}

/**
 * Returns a position number for the end of the list.
 */
Person.getNextPosition = function() {
	var maxPos = 0;
	for (var id in Person.list) {
		if (Person.list[id].position > maxPos) {
			maxPos = Person.list[id].position;
		}
	}

	return 1 + (maxPos * 2) / 2;
}

/**
 * Moves a Person to a different position on the manually-ordered list.
 */
Person.reposition = function(fromIndex, toIndex) {
	var list = Person._sortList(Person.SORT_MANUAL);
	var item = list[fromIndex];
	list.splice(fromIndex, 1);
	list.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, item);

	for (var i = 0; i < list.length; i++) {
		list[i].position = i + 1;
	}

	Person.saveList();
}

/**
 * Returns the number of visible people in the database.
 */
Person.getCount = function(onSuccess) {
	onSuccess(Person.visibleCount);
}

/**
 * Creates the SQLite table that holds people.
 */
Person.setupDB = function(tx, onSuccess) {
	tx.executeSql(
		'CREATE TABLE IF NOT EXISTS person (' +
			' id INTEGER,' +
			' name TEXT,' +
			' balance INTEGER,' +
			' position INTEGER,' +
			' visible INTEGER,' +
			' PRIMARY KEY (id)' +
		')',
		[],
		onSuccess,
		DBUtil.logFailure);
}
