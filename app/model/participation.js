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

	/** Returns a serializable (simple object) version of this participation. */
	simplify: function() {
		return {
			personId: this.person.id,
			ddEventId: this.ddEvent.id,
			isSharing: this.isSharing,
			shareIsFixed: this.shareIsFixed,
			additionalAmount: this.additionalAmount,
			total: this.total,
		};
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
			DDEvent.get(obj.ddEventId),
			obj.isSharing,
			obj.shareIsFixed,
			obj.additionalAmount,
			obj.total);
}
