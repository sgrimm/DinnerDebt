/**
 * Database-related utility functions.
 */
var DBUtil = Class.create({});

/**
 * Logs a database error; this is a generic onFailure handler for
 * DB calls.
 */
DBUtil.logFailure = function(tx, error) {
	Mojo.Log.error('Database operation failed');
	Mojo.Log.logProperties(error, 'dbError');
};

/**
 * Brings a database schema up to date. This keeps track of the current
 * schema revision in a reserved table "schema_info". Pass it an array of
 * schema changes and it will start at the revision pointed to by the current
 * revision number (that is, at array index 0 if this is the first time
 * the schema is being updated, array index 1 if the first schema operation
 * was executed on a previous run, etc.) For each successful schema update,
 * the current revision number is incremented.
 *
 * @param Object db
 *    Database handle as returned by window.openDatabase().
 * @param array operations
 *    Schema update operations. These will be played in order. If an
 *    operation is a string, that query will be executed. If an operation
 *    is a function, it will be called with a transaction object, a
 *    success callback function, and a failure callback function. It is
 *    not a good idea to ever remove statements from this array since the
 *    array index is stored in the database!
 * @param Function onSuccess
 *    Function to call when the schema is brought up to date. No parameters
 *    are passed to this function.
 * @param Function onFailure
 *    Function to call if the schema update fails. An error message is passed
 *    as a parameter.
 * @return bool
 *    This function does its work asynchronously; its return value is always
 *    true but you should use the onSuccess callback to perform work that has
 *    to happen after the schema update finishes.
 */
DBUtil.updateSchema = function(db, operations, onSuccess, onFailure) {
	// No point calling with no operations, but who knows...
	if (operations == null || operations.length == 0) {
		onSuccess();
		return;
	}

	// First figure out where we stand right now.
	db.transaction(function(tx) {
		tx.executeSql(
			'SELECT revision FROM schema_info',
			[],
			function(tx, result) {
				switch (result.rows.length) {
					case 0:
						// This should never happen; we should always be
						// initializing the current revision to 0 at table
						// creation time.
						onFailure.defer(
							"Can't determine current schema revision: " +
							"schema_info has no rows");
						break;

					case 1:
						// Got the current revision number.
						var nextRev = result.rows.item(0).revision;
						if (DBUtil.updateSchema.verbose) {
							Mojo.Log.info("Next schema revision is", nextRev);
						}
						DBUtil.updateSchema.advance.defer(db, operations,
												nextRev, onSuccess, onFailure);
						break;

					default:
						onFailure.defer(
							"Can't determine current schema revision: " +
							"schema_info has too many rows");
						break;
				}
			},
			function(tx, error) {
				if (error.message == 'no such table: schema_info') {
					if (DBUtil.updateSchema.verbose) {
						Mojo.Log.info("No schema version table yet");
					}

					// Use ourselves to bootstrap
					DBUtil.updateSchema.advance.defer(db, [
							'CREATE TABLE schema_info (' +
								'revision INTEGER NOT NULL)',
							'INSERT INTO schema_info (revision) VALUES (0)'
						],
						0,
						function() {
							DBUtil.updateSchema.advance.defer(db, operations, 0,
														onSuccess, onFailure);
						},
						function(message) {
							onFailure.defer("Can't set up schema revision " +
											"table: " + message);
						}
					);
				} else {
					onFailure.defer(
						"Can't determine current schema revision: " +
						error.message);
				}

				return false;	// no need to roll back
			}
		);
	});

	return true;
};

/**
 * Updates the schema to a particular revision if available. This is used
 * internally by DBUtil.updateSchema; don't call it directly.
 */
DBUtil.updateSchema.advance = function(db, ops, nextRev, onSuccess, onFailure) {
	if (nextRev == ops.length) {
		// Yay, we're up to date.
		if (DBUtil.updateSchema.verbose) {
			Mojo.Log.info("Schema is up to date");
		}
		onSuccess.defer();
		return;
	}

	if (DBUtil.updateSchema.verbose) {
		Mojo.Log.info("Trying to advance schema to revision", nextRev);
	}

	// Called after a successful operation.
	var updateRevision = function(tx) {
		if (DBUtil.updateSchema.verbose) {
			Mojo.Log.info("Updating schema version to", nextRev + 1);
		}

		try {
			tx.executeSql(
				'UPDATE schema_info SET revision = ?',
				[nextRev + 1],
				function(tx, result) {
					// Move on to the next revision, if any. Need to use
					// defer() here so that the current transaction gets
					// committed first.
					DBUtil.updateSchema.advance.defer(db, ops, nextRev + 1,
														onSuccess, onFailure);
				},
				function(tx, error) {
					onFailure.defer("Couldn't update schema revision number " +
									"after successful update: " +
									error.message);
					return true;	// rollback
				}
			);
		} catch (e) {
			Mojo.Log.error('Schema version number update failed', e);
			throw e;
		}
	};

	var operation = ops[nextRev];

	var performUpdate = function() {
		db.transaction(function(tx) {
			if (typeof(operation) == 'string') {
				try {
					tx.executeSql(operation, [],
						function() {
							updateRevision(tx);
						},
						function(tx, error) {
							onFailure.defer("Can't execute schema update statement #" +
									nextRev + ": " + error.message);
							return true;	// rollback
						}
					);
				} catch (e) {
					Mojo.Log.error('Schema update failed', operation);
					Mojo.Log.logProperties(e);
					Mojo.Log.logProperties();
					throw e;
				}
			} else {
				try {
					// Try to detect if the callback function never calls either
					// our success or our failure callback; treat that as a
					// failure. 15 seconds should be plenty of time.
					var timeoutHandle = setTimeout(
						function() {
							onFailure.defer("Schema update function #" +
									nextRev + " timed out after 15 seconds");
						}, 
						15000);

					operation(tx,
						function() {
							clearTimeout(timeoutHandle);
							updateRevision(tx);
						},
						function() {
							clearTimeout(timeoutHandle);
							onFailure.defer("Schema update function #" +
									nextRev + " failed");
							return true;	// rollback
						}
					);
				}
				catch (e) {
					onFailure.defer("Schema update function threw exception: " +
						(typeof(e) == 'string' ? e : e.toString()));
					return true;	// rollback
				}
			}
		},
		function(err) {
			Mojo.Log.error("Couldn't update database schema", err);
			throw new Exception(err);
		});
	}

	if (typeof(operation['prepare']) == 'function') {
		// Do prep work that has to happen outside a transaction (e.g.,
		// because it opens its own transactions.)
		operation['prepare'](performUpdate, onFailure);
	} else {
		performUpdate();
	}
};

/**
 * If you want to trace schema update activity, set this to 1.
 */
DBUtil.updateSchema.verbose = 1;
