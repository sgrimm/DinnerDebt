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

