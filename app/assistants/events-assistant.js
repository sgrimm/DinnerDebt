function EventsAssistant() {
	/* this is the creator function for your scene assistant object. It will be passed all the 
	   additional parameters (after the scene name) that were passed to pushScene. The reference
	   to the scene controller (this.controller) has not be established yet, so any initialization
	   that needs the scene controller should be done in the setup function below. */
}

EventsAssistant.prototype.setup = function() {
	/* this function is for setup tasks that have to happen when the scene is first created */
	Mojo.Log.info("setting up events scene");

	/* use Mojo.View.render to render view templates and add them to the scene, if needed. */
	
	/* setup widgets here */
	this.controller.setupWidget('newEventButton',
		{
			label: 'New Event',
			disabled: false
		},
		{ });

	this.controller.setupWidget('eventsList',
		{
			itemTemplate : 'events/listitem',
			itemsCallback : this.itemsCallback.bind(this),
			formatters : {
				total : this.formatTotal.bind(this),
				date : this.formatDate.bind(this)
			},
		});
	
	/* add event handlers to listen to events from widgets */
	Mojo.Event.listen($('eventsHeader'), Mojo.Event.tap, this.handleHeaderTap.bind(this));
	Mojo.Event.listen($('newEventButton'), Mojo.Event.tap, this.handleNewEventTap.bind(this));
}

EventsAssistant.prototype.itemsCallback = function(listWidget, offset, count){
	Mojo.Log.info("want to fetch events from",offset,"count",count);
	DDEvent.getList(
		function(list) {
			Mojo.Log.info("in callback with list of size", list.length);
			listWidget.mojo.noticeUpdatedItems(offset, list.slice(offset,offset+count));
		});
};

EventsAssistant.prototype.formatTotal = function(val, obj) {
	return Mojo.Format.formatCurrency(val / 100.0, 2);
};

EventsAssistant.prototype.formatDate = function(val, obj) {
	return Mojo.Format.formatDate(val, {date:'short'});
};

EventsAssistant.prototype.activate = function(event) {
	/* put in event handlers here that should only be in effect when this scene is active. For
	   example, key handlers that are observing the document */
}


EventsAssistant.prototype.deactivate = function(event) {
	/* remove any event handlers you added in activate and do any other cleanup that should happen before
	   this scene is popped or another scene is pushed on top */
}

EventsAssistant.prototype.cleanup = function(event) {
	/* this function should do any cleanup needed before the scene is destroyed as 
	   a result of being popped off the scene stack */
}

/**
 * Handles a tap on the "Events" header (switches to People view.)
 */
EventsAssistant.prototype.handleHeaderTap = function(event) {
	this.controller.stageController.swapScene('people');
}

/**
 * Handles a tap on the "New Event" button.
 */
EventsAssistant.prototype.handleNewEventTap = function(event) {
	this.controller.stageController.pushScene('editevent');
}
