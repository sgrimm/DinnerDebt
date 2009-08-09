function PeopleAssistant(stageAssistant) {
	/* this is the creator function for your scene assistant object. It will be passed all the 
	   additional parameters (after the scene name) that were passed to pushScene. The reference
	   to the scene controller (this.controller) has not be established yet, so any initialization
	   that needs the scene controller should be done in the setup function below. */
	this.stageAssistant = stageAssistant;
}

PeopleAssistant.prototype.setup = function() {
	/* this function is for setup tasks that have to happen when the scene is first created */

	/* use Mojo.View.render to render view templates and add them to the scene, if needed. */
	
	/* setup widgets here */
	this.controller.setupWidget("peopleList",
		{
			itemTemplate: "people/listitem",
			addItemLabel: $L("Add Person"),
			swipeToDelete: true,
			reorderable: true,
			itemsCallback : this.itemsCallback.bind(this),
			formatters : {
				balance : this.formatBalance.bind(this),
				name : this.formatName.bind(this),
			}
		});
	
	this.viewMenuModel = {
		visible: true,
		items: [{
			toggleCmd: 'people',
			items: [
				{ label: 'Events', command: 'events', width: 120 },
				{ label: 'People', command: 'people', width: 120 },
			]
		},{
			items: [
				{ label: 'Sort', submenu: 'sort-menu' }
			]
		}]
	};
	
	this.sortMenuModel = {
		label: $L('Sort By'),
		items: [
			{ label: $L('Name'), command: 'name' },
			{ label: $L('Balance'), command: 'balance' },
			{ label: $L('Manual'), command: 'manual' }
		]};
	
	this.controller.setupWidget(Mojo.Menu.viewMenu,
		{
			spacerHeight: 0,
			menuClass: 'no-fade'
		},
		this.viewMenuModel);
	this.controller.setupWidget('sort-menu', undefined, this.sortMenuModel);

	/* add event handlers to listen to events from widgets */
	this.controller.listen('peopleList', Mojo.Event.listAdd, this.handleListAdd.bind(this));

	this.peopleListWidget = this.controller.get('peopleList');
}

PeopleAssistant.prototype.itemsCallback = function(listWidget, offset, count) {
	Person.getList(this.stageAssistant.personSortOrder,
		function(list) {
			listWidget.mojo.noticeUpdatedItems(offset, list.slice(offset, offset+count));
		});
};

PeopleAssistant.prototype.formatBalance = function(val, obj) {
	return Mojo.Format.formatCurrency(val / 100.0, 2);
};

PeopleAssistant.prototype.formatName = function(val, obj) {
	return '<span class="dd-balance-' +
			(obj.balance < 0 ? 'negative' : 'positive') +
			'">' + val + '</span>';
}

PeopleAssistant.prototype.activate = function(event) {
	/* put in event handlers here that should only be in effect when this scene is active. For
	   example, key handlers that are observing the document */
}


PeopleAssistant.prototype.deactivate = function(event) {
	/* remove any event handlers you added in activate and do any other cleanup that should happen before
	   this scene is popped or another scene is pushed on top */
}

PeopleAssistant.prototype.cleanup = function(event) {
	/* this function should do any cleanup needed before the scene is destroyed as 
	   a result of being popped off the scene stack */
}

/**
 * Handles a command from a system menu.
 */
PeopleAssistant.prototype.handleCommand = function(event) {
	if (event.type == Mojo.Event.command) {
		switch (event.command) {
			case 'name':
				this.stageAssistant.setPersonSortOrder(Person.SORT_NAME);
				break;
			case 'balance':
				this.stageAssistant.setPersonSortOrder(Person.SORT_BALANCE);
				break;
			case 'manual':
				Mojo.Log.warn('Manual sort not implemented yet');
				break;
				
			case 'events':
				this.controller.stageController.swapScene('events', this.stageAssistant);
				return;
		}
	}

	this.peopleListWidget.mojo.invalidateItems(0);
}

/**
 * Handles a tap on the "add person" list item.
 */
PeopleAssistant.prototype.handleListAdd = function(event) {
	this.controller.showDialog({
		template: 'people/add-person-dialog',
		assistant: new AddPersonDialogAssistant(this),
	});
}

/**
 * Dialog assistant for the "Add Person" dialog.
 */
var AddPersonDialogAssistant = Class.create({
	initialize: function(sceneAssistant) {
		this.sceneAssistant = sceneAssistant;
		this.nameModel = { value: '' };
	},

	setup: function(widget) {
		var controller = this.sceneAssistant.controller;
		this.widget = widget;
		
		controller.setupWidget('okButton', {
			label: $L('OK'),
		}, { buttonClass: 'affirmative' });
		controller.setupWidget('cancelButton', {
			type: Mojo.Widget.defaultButton,
			label: $L('Cancel'),
		}, { buttonClass: 'negative' });
		controller.setupWidget('add-person-name', {
			hintText: 'Name...',
		}, this.nameModel);
		
		controller.listen('okButton', Mojo.Event.tap, this.handleOkTap.bind(this));
		controller.listen('cancelButton', Mojo.Event.tap, this.widget.mojo.close);
	},
	
	handleOkTap: function(event) {
		try {
		if (this.nameModel.value) {
			var person = new Person(0, this.nameModel.value, 0);
			person.add();
			Person.saveList();

			// Make the list update itself
			var mojo = this.sceneAssistant.peopleListWidget.mojo;
			Person.getCount(function(length) {
				mojo.setLengthAndInvalidate(length);
				mojo.revealItem(this.lastItemTapped ? this.lastItemTapped : length - 1);
			});
		}

		this.widget.mojo.close();
	} catch (e) { Mojo.Log.error(e); throw e; }
	},
});