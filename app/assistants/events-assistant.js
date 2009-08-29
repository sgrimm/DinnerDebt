function EventsAssistant(stageAssistant) {
	/* this is the creator function for your scene assistant object. It will be passed all the 
	   additional parameters (after the scene name) that were passed to pushScene. The reference
	   to the scene controller (this.controller) has not be established yet, so any initialization
	   that needs the scene controller should be done in the setup function below. */
	
	this.stageAssistant = stageAssistant;
	this.lastItemTapped = null;
}

EventsAssistant.prototype.setup = function() {
	/* this function is for setup tasks that have to happen when the scene is first created */
	this.mgr = new EventManager(this.controller);

	/* use Mojo.View.render to render view templates and add them to the scene, if needed. */
	
	/* setup widgets here */
	this.controller.setupWidget('eventsList',
		{
			itemTemplate : 'events/listitem',
			itemsCallback : this.itemsCallback.bind(this),
			formatters : {
				total : this.formatTotal.bind(this),
				date : this.formatDate.bind(this)
			},
			addItemLabel : $L('Add Event'),
		});

	this.controller.setupWidget(Mojo.Menu.viewMenu, {}, {
			items: [
				{
					toggleCmd: 'events',
					items: [
						{ label: 'Events', command: 'events', width: 160 },
						{ label: 'People', command: 'people', width: 160 },
					],
				},
			],
		});

	/* add event handlers to listen to events from widgets */
	this.eventsList = this.controller.get('eventsList');
	this.mgr.listen('eventsList', Mojo.Event.listTap, this.handleEventTap.bind(this));
	this.mgr.listen('eventsList', Mojo.Event.listAdd, this.handleAddTap.bind(this));
}

EventsAssistant.prototype.itemsCallback = function(listWidget, offset, count){
	try {
		DDEvent.getList(
			function(list) {
				listWidget.mojo.noticeUpdatedItems(offset, list.slice(offset,offset+count));
			});
	}
	catch (e) {
		Mojo.Log.error("Can't populate event list", e);
		throw e;
	}
};

EventsAssistant.prototype.formatTotal = function(val, obj) {
	return Mojo.Format.formatCurrency(val / 100.0, 2);
};

EventsAssistant.prototype.formatDate = function(val, obj) {
	return Mojo.Format.formatDate(val, {date:'short'});
};

/**
 * Does initialization that's needed whenever the scene is active.
 * For example, key handlers that are observing the document.
 */
EventsAssistant.prototype.activate = function(event) {
	var mojo = this.eventsList.mojo;
	DDEvent.getListLength(function(length) {
		mojo.setLengthAndInvalidate(length);
		mojo.revealItem(this.lastItemTapped ? this.lastItemTapped : length - 1);
	});

	try {
		this.mgr.activateHandlers();
	}
	catch (e) {
		Mojo.Log.warn(e);
	}
}


EventsAssistant.prototype.deactivate = function(event) {
	try {
		this.mgr.deactivateHandlers();
	}
	catch (e) {
		Mojo.Log.warn(e);
	}
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
EventsAssistant.prototype.handleCommand = function(event) {
	this.controller = Mojo.Controller.stageController.activeScene();
	if (event.type == Mojo.Event.command) {
		switch (event.command) {
			case 'people':
				this.controller.stageController.swapScene('people', this.stageAssistant);
				break;
		}
	}
}

/**
 * Handles a tap on the "Add Event" button.
 */
EventsAssistant.prototype.handleAddTap = function(event) {
	this.lastItemTapped = null;
	this.controller.stageController.pushScene('editevent', null, this.stageAssistant);
}

/**
 * Handles a tap on the event list.
 */
EventsAssistant.prototype.handleEventTap = function(event) {
	this.lastItemTapped = event.index;
	DDEvent.get(event.item.id, function(ddEvent) {
		Mojo.Log.info("Callback for event", ddEvent.id);
		this.controller.stageController.pushScene('editevent', ddEvent,
												this.stageAssistant);
	}.bind(this));
}
