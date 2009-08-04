function EditeventAssistant(eventId) {
	/* this is the creator function for your scene assistant object. It will be passed all the 
	   additional parameters (after the scene name) that were passed to pushScene. The reference
	   to the scene controller (this.controller) has not be established yet, so any initialization
	   that needs the scene controller should be done in the setup function below. */
	if (!eventId) {
		this.ddEvent = new DDEvent();
	}
}

EditeventAssistant.prototype.setup = function() {
	try {
		/* this function is for setup tasks that have to happen when the scene is first created */
		this.participationModels = {};
		this.drawersInitialized = {};
		
		/* use Mojo.View.render to render view templates and add them to the scene, if needed. */
		
		/* setup widgets here */
		this.dateModel = {
			value: new Date()
		};
		this.descriptionModel = {
			value: this.ddEvent.description
		};
		this.priceModel = {};
		this.populatePriceModel(this.ddEvent, this.priceModel);
		
		this.controller.setupWidget('date', {
			label: 'Date',
			modelProperty: 'value'
		}, this.dateModel);
		
		this.controller.setupWidget('description', {
			hintText: $L("Description..."),
			modelProperty: 'value'
		}, this.descriptionModel);
		
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
			swipeToDelete: true,
			reorderable: true,
			itemsCallback: this.itemsCallback.bind(this),
			formatters: {
				name: this.formatName.bind(this),
				isPayer: this.formatIsPayer.bind(this)
			},
			onItemRendered: this.itemRenderedCallback.bind(this),
		});
		
		/* add event handlers to listen to events from widgets */
		this.controller.listen('subtotal', Mojo.Event.propertyChange, this.subtotalChanged.bind(this));
		this.controller.listen('tipPercent', Mojo.Event.propertyChange, this.tipPercentChanged.bind(this));
		Mojo.Event.listen($('total'), Mojo.Event.propertyChange, this.totalChanged.bind(this));
		Mojo.Event.listen($('peopleList'), Mojo.Event.listTap, this.handlePeopleTap.bind(this));
		
		this.peopleListWidget = this.controller.get('peopleList');

	} catch (e) { Mojo.Log.warn("Exception in EditEventAssistant.setup", e); throw e; }
}

/** List position, indexed by person ID */
EditeventAssistant.prototype.listPositions = {};

EditeventAssistant.prototype.itemsCallback = function(listWidget, offset, count) {
	// load participant list
	Person.getList(this.sortOrder,
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
}

/**
 * Called when a list item is rendered, so we can set up the associated drawer widget.
 */
EditeventAssistant.prototype.itemRenderedCallback = function(listWidget, itemModel, itemNode) {
	var id = itemModel.id;

	this.controller.listen('total' + id, Mojo.Event.tap, this.handleDrawerButtonTap.bind(this, id));
	this.controller.setWidgetModel($('shareCheckbox' + id), this.participationModels[id]);
	this.controller.listen('shareCheckbox' + id, Mojo.Event.propertyChange,
							this.recalculateShare.bind(this, id));
}

EditeventAssistant.prototype.formatTotal = function(val, obj) {
	return Mojo.Format.formatCurrency(val / 100.0, 2);
};

/**
 * Formats a decimal value (no currency symbol).
 */
EditeventAssistant.prototype.formatDecimal = function(val) {
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
}

EditeventAssistant.prototype.formatName = function(val, obj) {
	return val;
}

EditeventAssistant.prototype.formatIsPayer = function(val, obj) {
	if (val) {
		return '(Paying)';
	}
	return '';
}

EditeventAssistant.prototype.activate = function(event) {
	/* put in event handlers here that should only be in effect when this scene is active. For
	   example, key handlers that are observing the document */
}


EditeventAssistant.prototype.deactivate = function(event) {
	/* remove any event handlers you added in activate and do any other cleanup that should happen before
	   this scene is popped or another scene is pushed on top */
}

EditeventAssistant.prototype.cleanup = function(event) {
	/* this function should do any cleanup needed before the scene is destroyed as 
	   a result of being popped off the scene stack */
}

/**
 * Handles a tap on the list of people, which will toggle a person's participation checkbox
 * (which will then trigger a checkbox change event where we'll do our business logic.)
 */
EditeventAssistant.prototype.handlePeopleTap = function(event) {
	var personId = event.item.id;
	var model = this.participationModels[personId];
	model.isSharing = !model.isSharing;
	this.controller.modelChanged(this.participationModels[personId], this);
}

/**
 * Handles a tap on the price button, which will open/close the person's details drawer.
 */
EditeventAssistant.prototype.handleDrawerButtonTap = function(id, event) {
	try {

	if (!this.drawersInitialized[id]) {
		// Need to inject DOM here because if we make it part of the list item template,
		// Mojo will set up all these widgets when the list item is rendered, which doesn't
		// give us a chance to call setupWidget to alter the default attributes.
		
		this.controller.setupWidget('personDrawer' + id, {}, {open:false});
		this.controller.setupWidget('personPayer' + id, {
			modelProperty: 'isPaying'
		});
		this.controller.setupWidget('additionalAmount' + id, {
			hintText: '0.00',
			modelProperty: 'additionalAmount',
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
				'<div class="palm-group unlabeled">'+
					'<div id="personPayerRow'+id+'" class="palm-row first">'+
						'<div class="palm-row-wrapper">'+
							'<div class="dd-payingRow">'+
								'<div id="personPayer'+id+'" class="dd-payingCheckbox" x-mojo-element="CheckBox"></div>'+
								'<div class="dd-amountIs">This person is paying</div>'+
							'</div>'+
						'</div>'+
					'</div>'+
					'<div class="palm-row last">'+
						'<div class="palm-row-wrapper dd-amountRow">'+
							'<div class="dd-amountRow">'+
								'<div id="shareIsFixed'+id+'" class="dd-sharefixed" x-mojo-element="ToggleButton"></div>'+
								'<div class="dd-amountIs">amount:</div>'+
								'<div id="additionalAmount'+id+'" class="dd-additionalAmount" x-mojo-element="TextField"></div>'+
							'</div>'+
						'</div>'+
					'</div>'+
				'</div>'+
			'</div>');

		this.controller.setWidgetModel($('personPayer' + id), this.participationModels[id]);
		this.controller.listen('personPayerRow' + id, Mojo.Event.tap, this.togglePayingCheckbox.bind(this, id));
		this.controller.listen('personPayer' + id, Mojo.Event.propertyChange, this.togglePayingCheckbox.bind(this, id));
		this.controller.listen('additionalAmount' + id, Mojo.Event.propertyChange, this.recalculateShare.bind(this, id));
		this.controller.listen('shareIsFixed' + id, Mojo.Event.propertyChange, this.recalculateShare.bind(this, id));

		this.drawersInitialized[id] = true;

		// Swallow taps on the drawer so they don't toggle the checkbox.
		this.controller.listen('personDrawer' + id, Mojo.Event.tap, this.handleDrawerTap.bind(this));

	}

	this.controller.get('personDrawer' + id).mojo.toggleState();

	event.stopPropagation();
	} catch (e) { Mojo.Log.error("exception in itemrendered", e); throw e; }

}

/**
 * Handles a tap on the drawer (but not on a specific control).
 */
EditeventAssistant.prototype.handleDrawerTap = function(event) {
	event.stopPropagation();
}

/**
 * Validates a character in one of the numeric input fields.
 */
EditeventAssistant.prototype.checkNumeric = function(c) {
	/* 0-9 and . */
	return c >= 48 && c <= 57 || c == 46;
}

/**
 * Handles a change to the subtotal field.
 */
EditeventAssistant.prototype.subtotalChanged = function(event) {
	var subtotal = parseFloat(event.value);
	if (subtotal != Number.NaN) {
		this.ddEvent.setSubtotal(Math.floor(subtotal * 100));
	}
	this.updateEventTotals();
}

/**
 * Handles a change to the tip percent field.
 */
EditeventAssistant.prototype.tipPercentChanged = function(event) {
	var percent = parseFloat(event.value);
	if (percent != Number.NaN) {
		this.ddEvent.setTipPercent(percent);
	}
	this.updateEventTotals();
}

/**
 * Handles a change to the total field.
 */
EditeventAssistant.prototype.totalChanged = function(event) {
	var total = parseFloat(event.value);
	if (total != Number.NaN) {
		this.ddEvent.setTotal(Math.floor(total * 100));
	}
	this.updateEventTotals();
}

EditeventAssistant.prototype.populatePriceModel = function(ddEvent, model) {
	model.subtotal = this.formatDecimal(ddEvent.getSubtotal());
	model.tipPercent = ddEvent.tipPercent ? ''+ddEvent.tipPercent : '';
	model.total = this.formatDecimal(ddEvent.getTotal());
}

/**
 * Updates the event money fields.
 */
EditeventAssistant.prototype.updateEventTotals = function() {
	this.populatePriceModel(this.ddEvent, this.priceModel);
	this.controller.modelChanged(this.priceModel, this);
	this.refreshParticipations();

	var tipAmount = this.ddEvent.getTipAmount();
	$('tipAmount').innerHTML = tipAmount ? ('(' + this.formatTotal(tipAmount) + ')') : '';
}

/**
 * Toggles the "this person is paying" checkbox.
 */
EditeventAssistant.prototype.togglePayingCheckbox = function(id, event) {
	if (this.ddEvent.getPayerId() == id) {
		this.setPayer(0);
	} else {
		this.setPayer(id);
	}
	
	if (event) {
		event.stopPropagation();
	}
}

/**
 * Sets the payer to a particular person and clears all the other checkboxes.
 */
EditeventAssistant.prototype.setPayer = function(newId) {
	for (var id in this.participationModels) {
		var part = this.participationModels[id];
		var newIsPaying = (id == newId);
		var oldIsPaying = part.isPaying;

		part.isPaying = newIsPaying;
		if (newIsPaying != oldIsPaying) {
			var isPayerMessage = this.controller.get('isPayerMessage' + id);
			isPayerMessage.innerHTML = this.formatIsPayer(newIsPaying);
			if (this.drawersInitialized[id]) {
				this.controller.modelChanged(part);
			}
		}
	}
	
	this.ddEvent.setPayerId(newId);
}

/**
 * Recalculates a person's share.
 */
EditeventAssistant.prototype.recalculateShare = function(id) {
	this.modelToParticipation(id);
	this.refreshParticipations();
}

/**
 * Copies the UI model object's values to an appropriate Participation object.
 */
EditeventAssistant.prototype.modelToParticipation = function(id) {
	var model = this.participationModels[id];
	var participation = this.ddEvent.getParticipationForUser(id);

	participation.isSharing = model.isSharing;
	participation.shareIsFixed = model.shareIsFixed;

	var addl = parseFloat(model.additionalAmount);
	if (isNaN(addl)) {
		addl = 0;
	}
	participation.additionalAmount = Math.floor(addl * 100);

	this.ddEvent.setParticipation(participation);
}

/**
 * Copies a Participation object's values to a UI model object. If
 * any of the read-only values have changed, sends the appropriate
 * update events.
 */
EditeventAssistant.prototype.participationToModel = function(id) {
	var model = this.participationModels[id];
	var participation = this.ddEvent.getParticipationForUser(id);

	model.isSharing = participation.isSharing;
	model.shareIsFixed = participation.shareIsFixed;
	model.additionalAmount = this.formatDecimal(participation.additionalAmount);
	model.isPaying = (this.ddEvent.getPayerId() == id);
	model.id = participation.personId;

	var newTotal = this.formatTotal(participation.total);
	if (model.total != newTotal) {
		model.total = newTotal;
		var element = this.controller.get('total' + id);
		if (element) {
			element.innerHTML = newTotal;
		}
	}
}

/**
 * Refreshes all the participation models, e.g., after a change in
 * the total price.
 */
EditeventAssistant.prototype.refreshParticipations = function() {
	for (var id in this.participationModels) {
		this.participationToModel(id);
	}
}
