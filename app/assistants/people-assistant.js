var PeopleAssistant = Class.create({
	initialize: function(stageAssistant) {
		this.stageAssistant = stageAssistant;
		this.appMenuModel = {
			items: [
				{ label: $L('About DinnerDebt...'), command: 'about' },
				{ label: $L('Recalculate Balances'), command: 'recalculate' },
				{ label: $L('Help'), command: 'help' },
			]
		};
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
			items: this.getSortMenuItems(),
		};

		this.controller.setupWidget(Mojo.Menu.viewMenu,
			{
				spacerHeight: 0,
				menuClass: 'no-fade'
			},
			this.viewMenuModel);
		this.controller.setupWidget('sort-menu', undefined, this.sortMenuModel);

		this.controller.setupWidget(Mojo.Menu.appMenu,
									{ omitDefaultItems: true },
									this.appMenuModel);

		this.mgr.listen('peopleList', Mojo.Event.listAdd,
						this.handleListAdd.bind(this));
		this.mgr.listen('peopleList', Mojo.Event.listTap,
						this.handleListTap.bind(this));
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

	getSortMenuItems: function() {
		var sortOrder = this.stageAssistant.personSortOrder;
		return [
				{
					label: $L('Name'),
					command: 'name',
					chosen: sortOrder == Person.SORT_NAME
				},{
					label: $L('Balance'),
					command: 'balance',
					chosen: sortOrder == Person.SORT_BALANCE
				},{
					label: $L('Manual'),
					command: 'manual',
					chosen: sortOrder == Person.SORT_MANUAL
				}
			];
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
					this.sortMenuModel.items = this.getSortMenuItems();
					break;
				case 'balance':
					this.stageAssistant.setPersonSortOrder(Person.SORT_BALANCE);
					this.sortMenuModel.items = this.getSortMenuItems();
					break;
				case 'manual':
					this.stageAssistant.setPersonSortOrder(Person.SORT_MANUAL);
					this.sortMenuModel.items = this.getSortMenuItems();
					break;

				case 'events':
					this.controller.stageController.swapScene('events', this.stageAssistant);
					return;

				case 'recalculate':
					var widget = this.peopleListWidget;
					var appController = this.controller.stageController
											.getAppController();
					Person.recalculateAll(function() {
						widget.mojo.invalidateItems(0);
						appController.showBanner($L('Recalculation complete'),
												'', 'recalc');
					});
					break;
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
			assistant: new AddEditPersonDialogAssistant(this, null),
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

	/**
	 * Handles a tap on a person's name.
	 */
	handleListTap: function(event) {
		this.controller.showDialog({
			template: 'people/add-person-dialog',
			assistant: new AddEditPersonDialogAssistant(this, event.item),
		});
	},

});


/**
 * Dialog assistant for the "Add/Edit Person" dialog.
 */
var AddEditPersonDialogAssistant = Class.create({
	initialize: function(sceneAssistant, person) {
		this.mgr = new EventManager(sceneAssistant.controller);
		this.sceneAssistant = sceneAssistant;
		this.person = person;
		this.nameModel = { value: person ? person.name : '' };
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

		controller.get('add-person-title').innerHTML =
			this.person ? $L('Edit Person') : $L('Add Person');
	},

	activate: function() {
		this.mgr.activateHandlers();
	},

	deactivate: function() {
		this.mgr.deactivateHandlers();
	},
	
	handleOkTap: function(event) {
		if (this.nameModel.value) {
			var updateList = function() {
				// Make the list update itself
				var mojo = this.sceneAssistant.peopleListWidget.mojo;
				var lastItemTapped = this.lastItemTapped;
				Person.getCount(function(length) {
					mojo.setLengthAndInvalidate(length);
					mojo.revealItem(lastItemTapped ? lastItemTapped : length - 1);
				});
			}.bind(this);

			if (this.person) {
				this.person.name = this.nameModel.value;
				Person.saveList(null, updateList);
			} else {
				this.person = new Person(0, this.nameModel.value, 0);
				this.person.add(updateList);
			}
		}

		this.widget.mojo.close();
	},
});
