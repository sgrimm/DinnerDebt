var EditeventAssistant = Class.create({
	initialize : function(ddEvent, stageAssistant, dismissCallback) {
		if (ddEvent) {
			this.ddEvent = ddEvent;
		} else {
			this.ddEvent = new DDEvent();
		}

		this.stageAssistant = stageAssistant;
		this.dismissCallback = dismissCallback;

		this.priceModel = {};
		this.listPositions = {};
		this.appMenuModel = {
			items: [
				{ label: $L('About DinnerDebt...'), command: 'about' },
				{ label: $L('Delete Event'), command: 'deleteEvent' },
				{ label: $L('Help'), command: 'help.editEvent' },
			]
		};

		this.doDeleteEvent = this.doDeleteEvent.bind(this);
	},

	setup : function() {
		try {
			/* this function is for setup tasks that have to happen when the scene is first created */
			this.mgr = new EventManager(this.controller);

			this.participationModels = {};
			this.drawersInitialized = {};

			/* use Mojo.View.render to render view templates and add them to the scene, if needed. */

			/* setup widgets here */
			this.controller.setupWidget('date', {
				label: 'Date',
				modelProperty: 'date'
			}, this.ddEvent);
		
			this.controller.setupWidget('description', {
				hintText: $L("Description..."),
				modelProperty: 'description'
			}, this.ddEvent);
		
			this.controller.setupWidget('subtotal', {
				hintText: $L("Bill..."),
				modelProperty: 'subtotal',
				preventResize: true,
				maxLength: 7,
				charsAllow: this.checkNumeric.bind(this),
				modifierState: Mojo.Widget.numLock,
			});
			this.controller.setWidgetModel($('subtotal'), this.priceModel);
		
			this.controller.setupWidget('tipPercent', {
				hintText: $L("Tip..."),
				modelProperty: 'tipPercent',
				maxLength: 6,
				charsAllow: this.checkNumeric.bind(this),
				modifierState: Mojo.Widget.numLock,
			}, this.priceModel);
			this.controller.setWidgetModel($('tipPercent'), this.priceModel);
		
			this.controller.setupWidget('total', {
				hintText: $L("Total..."),
				modelProperty: 'total',
				charsAllow: this.checkNumeric.bind(this),
				modifierState: Mojo.Widget.numLock,
			}, this.priceModel);
			this.controller.setWidgetModel($('total'), this.priceModel);
		
			this.controller.setupWidget('peopleList', {
				itemTemplate: "editevent/person-listitem",
				itemsCallback: this.itemsCallback.bind(this),
				formatters: {
					name: this.formatName.bind(this),
					isPayer: this.formatIsPayer.bind(this)
				},
				onItemRendered: this.itemRenderedCallback.bind(this),
			});

			this.controller.setupWidget(Mojo.Menu.appMenu,
										{ omitDefaultItems: true },
										this.appMenuModel);

			this.populatePriceModel(this.ddEvent, this.priceModel, true);
			this.updateTipAmount();

			/* add event handlers to listen to events from widgets */
			this.mgr.listen('subtotal', Mojo.Event.propertyChange, this.subtotalChanged.bind(this));
			this.mgr.listen('tipPercent', Mojo.Event.propertyChange, this.tipPercentChanged.bind(this));
			this.mgr.listen('total', Mojo.Event.propertyChange, this.totalChanged.bind(this));
			this.mgr.listen('peopleList', Mojo.Event.listTap, this.handlePeopleTap.bind(this));
		
			this.peopleListWidget = this.controller.get('peopleList');

		} catch (e) { Mojo.Log.warn("Exception in EditEventAssistant.setup", e); throw e; }
	},

	/** List position, indexed by person ID */
	listPositions : {},

	itemsCallback : function(listWidget, offset, count) {
		// If the event is new, need to find the biggest debtor so we can set them
		// as the default payer. That's an async operation, and we want to do it
		// before populating the list of people.
		if (!this.ddEvent.getPayer()) {
			Person.getList(Person.SORT_BALANCE,
				function(list) {
					// The first entry in the list is our default payer.
					if (list.length > 0 && !this.ddEvent.getPayer()) {
						this.ddEvent.setPayer(list[0]);
						this.populatePeopleList(listWidget, offset, count);
					}
				}.bind(this));
		} else {
			this.populatePeopleList(listWidget, offset, count);
		}
	},
	
	/**
	 * Populates the list of people. This is indirectly called from
	 * itemsCallback() and does most of the actual work.
	 */
	populatePeopleList: function(listWidget, offset, count) {
		Person.getList(this.stageAssistant.personSortOrder,
			function(list) {
				var updatedList = [];
				for (var i = 0; i < list.length; i++) {
					var entry = list[i];
					var id = entry.id;
					this.participationModels[id] = {
						id: id,
						name: entry.name,
					};
					this.participationToModel(id);
					updatedList.push(this.participationModels[id]);
					this.listPositions[id] = offset + i;

					this.controller.setupWidget('shareCheckbox' + id, {
						modelProperty: 'isSharing'
					}, this.participationModels[id]);
				}

				listWidget.mojo.noticeUpdatedItems(offset, updatedList.slice(offset, offset+count));
			}.bind(this));
	},

	/**
	 * Called when a list item is rendered, so we can set up the associated drawer widget.
	 */
	itemRenderedCallback : function(listWidget, itemModel, itemNode) {
		var id = itemModel.id;

		this.mgr.listen('total' + id, Mojo.Event.tap, this.handleDrawerButtonTap.bind(this, id));
		this.controller.setWidgetModel($('shareCheckbox' + id), this.participationModels[id]);
		this.mgr.listen('shareCheckbox' + id, Mojo.Event.propertyChange,
								this.recalculateShare.bind(this, id));
	},

	formatTotal : function(val, obj) {
		return Mojo.Format.formatCurrency(val / 100.0, 2);
	},

	/**
	 * Formats a decimal value (no currency symbol).
	 */
	formatDecimal : function(val) {
		if (val == 0) {
			return '';
		}
		val /= 100.0;

		// Just use the raw string representation of the non-fractional part
		// of the amount; don't want commas inserted.
		var nonfractional = Math.floor(val);
		var str = '' + nonfractional;

		// But we do want to use a locale-appropriate decimal point, so let
		// Mojo.Format.formatNumber take care of that.
		var decimal = Mojo.Format.formatNumber(val - nonfractional, 2);
		if (decimal.charAt(0) == '0') {
			return str + decimal.substring(1);
		}
		return str + decimal;
	},

	formatName : function(val, obj) {
		return val;
	},

	formatIsPayer : function(val, obj) {
		if (val) {
			return '(Paying)';
		}
		return '';
	},

	activate : function(event) {
		this.mgr.activateHandlers();
	},


	deactivate : function(event) {
		this.mgr.deactivateHandlers();
	},

	/**
	 * Cleans up after the scene. Called before the scene is destroyed as 
	 * a result of being popped off the scene stack.
	 */
	cleanup : function(event) {
		if (this.ddEvent.isWorthKeeping()) {
			this.ddEvent.save(null, this.dismissCallback);
		} else {
			this.dismissCallback();
		}
	},

	/**
	 * Handles a tap on the list of people, which will toggle a person's participation checkbox
	 * (which will then trigger a checkbox change event where we'll do our business logic.)
	 */
	handlePeopleTap : function(event) {
		var personId = event.item.id;
		var model = this.participationModels[personId];
		model.isSharing = !model.isSharing;
		this.controller.modelChanged(this.participationModels[personId], this);
		this.recalculateShare(personId);
	},

	/**
	 * Handles a tap on the price button, which will open/close the person's details drawer.
	 */
	handleDrawerButtonTap : function(id, event) {
		try {

		if (!this.drawersInitialized[id]) {
			// Need to inject DOM here because if we make it part of the list item template,
			// Mojo will set up all these widgets when the list item is rendered, which doesn't
			// give us a chance to call setupWidget to alter the default attributes.
		
			this.controller.setupWidget('personDrawer' + id, {}, {open:false});
			this.controller.setupWidget('personPayerButton' + id, {
				label: $L('This person is paying'),
			});
			this.controller.setupWidget('additionalAmount' + id, {
				hintText: '0.00',
				modelProperty: 'additionalAmount',
				charsAllow: this.checkNumeric.bind(this),
				modifierState: Mojo.Widget.numLock,
			}, this.participationModels[id]);
			this.controller.setupWidget('shareIsFixed' + id, {
				trueLabel: 'Entire',
				trueValue: true,
				falseLabel: 'Extra',
				falseValue: false,
				modelProperty: 'shareIsFixed',
			}, this.participationModels[id]);

			this.controller.update(this.controller.get('personDrawerContainer' + id),
				'<div id="personDrawer'+id+'" class="dd-drawer" x-mojo-element="Drawer">'+
					'<div id="personPayerButton'+id+'" class="dd-payerButton" x-mojo-element="Button"></div>'+
					'<div class="dd-amountRow">'+
						'<div id="shareIsFixed'+id+'" class="dd-sharefixed" x-mojo-element="ToggleButton"></div>'+
						'<div class="dd-amountIs">amount:</div>'+
						'<div id="additionalAmount'+id+'" class="dd-additionalAmount" x-mojo-element="TextField"></div>'+
					'</div>'+
				'</div>');

			this.mgr.listen('personPayerButton' + id, Mojo.Event.tap, this.setPayer.bind(this, id));
			this.mgr.listen('additionalAmount' + id, Mojo.Event.propertyChange, this.recalculateShare.bind(this, id));
			this.mgr.listen('shareIsFixed' + id, Mojo.Event.propertyChange, this.recalculateShare.bind(this, id));

			this.drawersInitialized[id] = true;

			// Swallow taps on the drawer so they don't toggle the checkbox.
			this.mgr.listen('personDrawer' + id, Mojo.Event.tap, this.handleDrawerTap.bind(this));

		}

		this.controller.get('personDrawer' + id).mojo.toggleState();

		event.stopPropagation();
		} catch (e) { Mojo.Log.error("exception in itemrendered", e); throw e; }

	},

	/**
	 * Handles a tap on the drawer (but not on a specific control).
	 */
	handleDrawerTap : function(event) {
		event.stopPropagation();
	},

	/**
	 * Validates a character in one of the numeric input fields.
	 */
	checkNumeric : function(c) {
		/* 0-9 and . */
		return c >= 48 && c <= 57 || c == 46;
	},

	/**
	 * Handles a change to the subtotal field.
	 */
	subtotalChanged : function(event) {
		var subtotal = parseFloat(event.value);
		if (subtotal != Number.NaN) {
			this.ddEvent.setSubtotal(Math.floor(subtotal * 100));
		}
		this.updateEventTotals();
	},

	/**
	 * Handles a change to the tip percent field.
	 */
	tipPercentChanged : function(event) {
		var percent = parseFloat(event.value);
		if (percent != Number.NaN) {
			this.ddEvent.setTipPercent(percent);
		}
		this.updateEventTotals();
	},

	/**
	 * Handles a change to the total field.
	 */
	totalChanged : function(event) {
		var total = parseFloat(event.value);
		if (total != Number.NaN) {
			this.ddEvent.setTotal(Math.floor(total * 100));
		}
		this.updateEventTotals();
	},

	populatePriceModel : function(ddEvent, model, skipModelChangedEvent) {
		model.subtotal = this.formatDecimal(ddEvent.getSubtotal());
		model.tipPercent = ddEvent.tipPercent ? ''+ddEvent.tipPercent : '';
		model.total = this.formatDecimal(ddEvent.getTotal());
		if (!skipModelChangedEvent) {
			this.controller.modelChanged(model, this);
		}
	},

	/**
	 * Updates the event money fields.
	 */
	updateEventTotals : function() {
		this.populatePriceModel(this.ddEvent, this.priceModel);
		this.ddEvent.recalculateShares();
		this.refreshParticipations();
		this.updateTipAmount();
	},
	
	/**
	 * Updates the "tip amount" display.
	 */
	updateTipAmount: function() {
		var tipAmount = this.ddEvent.getTipAmount();
		$('tipAmount').innerHTML = tipAmount ? ('(' + this.formatTotal(tipAmount) + ')') : '';
	},

	/**
	 * Sets the payer to a particular person and clears all the other checkboxes.
	 */
	setPayer : function(newId) {
		var oldId = this.ddEvent.getPayerId();
		if (oldId == newId) {
			Mojo.Log.info("Setting payer to", id, "but is already", id);
			return;
		}

		if (oldId) {
			var elt = this.controller.get('isPayerMessage' + oldId);
			if (elt) {
				elt.innerHTML = '';
			}
			this.participationModels[oldId].isPayer = false;
			this.controller.modelChanged(this.participationModels[oldId]);
		}
		if (newId) {
			var elt = this.controller.get('isPayerMessage' + newId);
			if (elt) {
				elt.innerHTML = this.formatIsPayer(true);

				// Work around a WebKit bug by forcing it to redo layout;
				// without this, the "(paying)" message will force the
				// total off the right side of the screen.
				elt = this.controller.get('total' + newId);
				elt.innerHTML = elt.innerHTML + '<span></span>';
			}
			this.participationModels[newId].isPayer = true;
			this.controller.modelChanged(this.participationModels[newId]);
		}
	
		this.ddEvent.setPayerId(newId);
	},

	/**
	 * Recalculates a person's share.
	 */
	recalculateShare : function(id) {
		this.modelToParticipation(id);
		this.refreshParticipations();
	},

	/**
	 * Copies the UI model object's values to an appropriate Participation object.
	 */
	modelToParticipation : function(id) {
		var model = this.participationModels[id];
		var ddEvent = this.ddEvent;
		var participation = ddEvent.getParticipationForUser(id);
		participation.isSharing = model.isSharing;
		participation.shareIsFixed = model.shareIsFixed;

		var addl = parseFloat(model.additionalAmount);
		if (isNaN(addl)) {
			addl = 0;
		}
		participation.additionalAmount = Math.floor(addl * 100);

		ddEvent.setParticipation(participation);
	},

	/**
	 * Copies a Participation object's values to a UI model object. If
	 * any of the read-only values have changed, sends the appropriate
	 * update events.
	 */
	participationToModel : function(id) {
		var model = this.participationModels[id];
		var participation = this.ddEvent.getParticipationForUser(id);
		model.isSharing = participation.isSharing;
		model.shareIsFixed = participation.shareIsFixed;
		model.additionalAmount = this.formatDecimal(participation.additionalAmount);
		model.isPayer = (this.ddEvent.getPayerId() == id);
		model.id = participation.person.id;

		var newTotal = this.formatTotal(participation.total);
		if (model.total != newTotal) {
			model.total = newTotal;
			var element = this.controller.get('total' + id);
			if (element) {
				element.innerHTML = newTotal;
			}
		}
	},

	/**
	 * Refreshes all the participation models, e.g., after a change in
	 * the total price.
	 */
	refreshParticipations : function() {
		for (var id in this.participationModels) {
			this.participationToModel(id);
		}
	},

	handleCommand: function(event) {
		if (event.type === Mojo.Event.command) {
			switch (event.command) {
			case 'help.editEvent':
				this.controller.stageController.pushScene('help', 'editEvent');
				break;

			case 'deleteEvent':
				this.controller.showDialog({
					template: 'editevent/delete-event-dialog',
					assistant: new ConfirmDeleteEventAssistant(this),
				});
				break;
			}
		}
	},

	/**
	 * Deletes the event. This is a callback from the confirmation dialog.
	 */
	doDeleteEvent: function() {
		this.ddEvent.doDelete(function() {
			this.controller.stageController.popScene();
		}.bind(this));
	},

});


/**
 * Assistant for the "do you really want to delete this event?" dialog.
 */
var ConfirmDeleteEventAssistant = Class.create({
	initialize: function(sceneAssistant) {
		this.mgr = new EventManager(sceneAssistant.controller);
		this.sceneAssistant = sceneAssistant;
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
		this.widget.mojo.close();
		this.sceneAssistant.doDeleteEvent();
	},
});
