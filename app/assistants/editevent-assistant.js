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
		this.shareCheckboxModels = {};
		
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
				total: this.formatTotal.bind(this),
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
		
	} catch (e) { Mojo.Log.warn("Exception in EditEventAssistant.setup", e); }
}

EditeventAssistant.prototype.itemsCallback = function(listWidget, offset, count) {
	// load participant list
	Person.getList(this.sortOrder,
		function(list) {
			var updatedList = [];
			for (var i = 0; i < list.length; i++) {
				updatedList.push({
					isPayer: list[i].name == 'Steve',
					total: null,
					name: list[i].name,
					id: list[i].id
				});
				this.shareCheckboxModels[list[i].id] = { value: false };
			}

			listWidget.mojo.noticeUpdatedItems(offset, updatedList.slice(offset, offset+count));
		}.bind(this));
}

/**
 * Called when a list item is rendered, so we can set up the associated drawer widget.
 */
EditeventAssistant.prototype.itemRenderedCallback = function(listWidget, itemModel, itemNode) {
	var id = itemModel.id;
	
	this.controller.setupWidget('shareCheckbox' + id);
	this.controller.setWidgetModel($('shareCheckbox' + id), this.shareCheckboxModels[id]);
	this.controller.setupWidget('personDrawer' + id, {}, {open:false});
	this.controller.listen('total' + id, Mojo.Event.tap, this.handleDrawerTap.bind(this));
}

EditeventAssistant.prototype.formatTotal = function(val, obj) {
	if (val == 0) {
		return '';
	}
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
	var model = this.shareCheckboxModels[personId];
	model.value = !model.value;
	this.controller.modelChanged(this.shareCheckboxModels[personId], this);
}

/**
 * Handles a tap on the price button, which will open/close the person's details drawer.
 */
EditeventAssistant.prototype.handleDrawerTap = function(event) {
	var elementId = event.target.id;
	var personId = elementId.substring(5); // remove "total"
	$('personDrawer' + personId).mojo.toggleState();

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

	var tipAmount = this.ddEvent.getTipAmount();
	$('tipAmount').innerHTML = tipAmount ? ('(' + this.formatTotal(tipAmount) + ')') : '';
}
