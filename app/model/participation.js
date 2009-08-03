/**
 * A single user's participation in an event.
 */
var Participation = Class.create({
	/** ID of Person who participated. */
	personId: 0,

	/** ID of DDEvent participated in. */
	ddEventId: 0,

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

	initialize: function(ddEventId, personId) {
		this.ddEventId = ddEventId;
		this.personId = personId;
	},
	
});
