var PeopleAssistant = Class.create({
	initialize: function(stageAssistant) {
		this.stageAssistant = stageAssistant;
	},

	setup: function() {
		this.mgr = new EventManager(this.controller);

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

		this.mgr.listen('peopleList', Mojo.Event.listAdd, this.handleListAdd.bind(this));
		this.mgr.listen('peopleList', Mojo.Event.listReorder,
						this.handleListReorder.bind(this));

		this.peopleListWidget = this.controller.get('peopleList');
	},

	itemsCallback: function(listWidget, offset, count) {
		Person.getList(this.stageAssistant.personSortOrder,
			function(list) {
				listWidget.mojo.noticeUpdatedItems(offset, list.slice(offset, offset+count));
			});
	},

	formatBalance: function(val, obj) {
		return Mojo.Format.formatCurrency(val / 100.0, 2);
	},

	formatName: function(val, obj) {
		return '<span class="dd-balance-' +
				(obj.balance < 0 ? 'negative' : 'positive') +
				'">' + val + '</span>';
	},

	activate: function(event) {
		this.mgr.activateHandlers();
	},

	deactivate: function(event) {
		this.mgr.deactivateHandlers();
	},

	cleanup: function(event) { },

	/**
	 * Handles a command from a system menu.
	 */
	handleCommand: function(event) {
		if (event.type == Mojo.Event.command) {
			switch (event.command) {
				case 'name':
					this.stageAssistant.setPersonSortOrder(Person.SORT_NAME);
					break;
				case 'balance':
					this.stageAssistant.setPersonSortOrder(Person.SORT_BALANCE);
					break;
				case 'manual':
					this.stageAssistant.setPersonSortOrder(Person.SORT_MANUAL);
					break;

				case 'events':
					this.controller.stageController.swapScene('events', this.stageAssistant);
					return;
			}
		}

		this.peopleListWidget.mojo.invalidateItems(0);
	},

	/**
	 * Handles a tap on the "add person" list item.
	 */
	handleListAdd: function(event) {
		this.controller.showDialog({
			template: 'people/add-person-dialog',
			assistant: new AddPersonDialogAssistant(this),
		});
	},

	/**
	 * Handles the user dragging an item on the person list to reorder it.
	 */
	handleListReorder: function(event) {
		if (this.stageAssistant.personSortOrder == Person.SORT_MANUAL) {
			Person.reposition(event.fromIndex, event.toIndex);
		} else {
			// Reset the list order
			// XXX - should just disable repositioning when sort order
			// is not Manual
			this.peopleListWidget.mojo.invalidateItems(0);
		}
	},

});


/**
 * Dialog assistant for the "Add Person" dialog.
 */
var AddPersonDialogAssistant = Class.create({
	initialize: function(sceneAssistant) {
		this.mgr = new EventManager(sceneAssistant.controller);
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
		
		this.mgr.listen('okButton', Mojo.Event.tap, this.handleOkTap.bind(this));
		this.mgr.listen('cancelButton', Mojo.Event.tap, this.widget.mojo.close);
	},

	activate: function() {
		this.mgr.activateHandlers();
	},

	deactivate: function() {
		this.mgr.deactivateHandlers();
	},
	
	handleOkTap: function(event) {
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
	},
});
