var EventsAssistant = Class.create({
	initialize: function(stageAssistant) {
		this.stageAssistant = stageAssistant;
		this.lastItemTapped = null;

		this.refreshList = this.refreshList.bind(this);
	},

	setup: function() {
		this.mgr = new EventManager(this.controller);

		this.controller.setupWidget('eventsList',
			{
				itemTemplate : 'events/listitem',
				itemsCallback : this.itemsCallback.bind(this),
				formatters : {
					total : this.formatTotal.bind(this),
					date : this.formatDate.bind(this)
				},
				addItemLabel : $L('Add Event'),
				swipeToDelete: true,
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

		this.eventsList = this.controller.get('eventsList');
		this.mgr.listen('eventsList', Mojo.Event.listTap, this.handleEventTap.bind(this));
		this.mgr.listen('eventsList', Mojo.Event.listAdd, this.handleAddTap.bind(this));
		this.mgr.listen('eventsList', Mojo.Event.listDelete, this.handleDelete.bind(this));
	},

	itemsCallback: function(listWidget, offset, count) {
		try {
			DDEvent.getList(
				function(list) {
					listWidget.mojo.noticeUpdatedItems(offset, list.slice(offset,offset+count));
					listWidget.mojo.revealItem(this.lastItemTapped ? this.lastItemTapped : list.length - 1);
				}.bind(this));
		}
		catch (e) {
			Mojo.Log.error("Can't populate event list", e);
			throw e;
		}
	},

	formatTotal: function(val, obj) {
		return Mojo.Format.formatCurrency(val / 100.0, 2);
	},

	formatDate: function(val, obj) {
		return Mojo.Format.formatDate(val, {date:'short'});
	},

	/**
	 * Does initialization that's needed whenever the scene is active.
	 * For example, key handlers that are observing the document.
	 */
	activate: function(event) {
		this.mgr.activateHandlers();
	},

	/**
	 * Refreshes the events list.
	 */
	refreshList: function() {
		var mojo = this.eventsList.mojo;
		DDEvent.getListLength(function(length) {
			mojo.setLengthAndInvalidate(length);
		});
	},

	deactivate: function(event) {
		try {
			this.mgr.deactivateHandlers();
		}
		catch (e) {
			Mojo.Log.warn(e);
		}
	},

	cleanup: function(event) { },

	handleCommand: function(event) {
		this.controller = Mojo.Controller.stageController.activeScene();
		if (event.type == Mojo.Event.command) {
			switch (event.command) {
				case 'people':
					this.controller.stageController.swapScene('people', this.stageAssistant);
					break;
			}
		}
	},

	/**
	 * Handles a tap on the "Add Event" button.
	 */
	handleAddTap: function(event) {
		this.lastItemTapped = null;
		this.controller.stageController.pushScene('editevent', null,
													this.stageAssistant,
													this.refreshList);
	},

	/**
	 * Handles a tap on the event list.
	 */
	handleEventTap: function(event) {
		this.lastItemTapped = event.index;
		event.item.load(function(ddEvent) {
			this.controller.stageController.pushScene('editevent', ddEvent,
													this.stageAssistant,
													this.refreshList);
		}.bind(this));
	},

	/**
	 * Handles a deletion from the event list.
	 */
	handleDelete: function(event) {
		event.item.load(function() { event.item.doDelete(); });
	},

});
