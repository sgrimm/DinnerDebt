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
	/* this function is for setup tasks that have to happen when the scene is first created */
	this.shareCheckboxModels = {};

	/* use Mojo.View.render to render view templates and add them to the scene, if needed. */
	
	/* setup widgets here */
	this.dateModel = { value: new Date() };
	this.descriptionModel = { value: this.ddEvent.description };
	this.subtotalModel = { value: this.formatDecimal(this.ddEvent.subtotal) };
	this.tipPercentModel = { value: this.ddEvent.tipPercent };
	this.totalModel = { value: this.formatDecimal(this.ddEvent.total) };

	this.controller.setupWidget('date',
		{
			label: 'Date',
			modelProperty: 'value'
		},
		this.dateModel);

	this.controller.setupWidget('description',
		{
			hintText: $L("Description..."),
			modelProperty: 'value'
		},
		this.descriptionModel);

	this.controller.setupWidget('subtotal',
		{
			hintText: $L("Bill..."),
			modelProperty: 'value',
			preventResize: true,
			maxLength: 7,
		},
		this.subtotalModel);

	this.controller.setupWidget('tipPercent',
		{
			hintText: $L("Tip..."),
			modelProperty: 'value',
			maxLength: 6,
		},
		this.tipPercentModel);

	this.controller.setupWidget('total',
		{
			hintText: $L("Total..."),
			modelProperty: 'value',
		},
		this.descriptionModel);
	
	this.controller.setupWidget('peopleList',
		{
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
		}
	);

	/* add event handlers to listen to events from widgets */
	this.controller.listen('subtotal', Mojo.Event.propertyChange, this.subtotalChanged.bind(this));
	this.controller.listen('tipPercent', Mojo.Event.propertyChange, this.tipPercentChanged.bind(this));
	Mojo.Event.listen($('total'), Mojo.Event.propertyChange, this.totalChanged.bind(this));
	Mojo.Event.listen($('peopleList'), Mojo.Event.listTap, this.handlePeopleTap.bind(this));
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
				})
			}

			listWidget.mojo.noticeUpdatedItems(offset, updatedList.slice(offset, offset+count));
		});
}

/**
 * Called when a list item is rendered, so we can set up the associated drawer widget.
 */
EditeventAssistant.prototype.itemRenderedCallback = function(listWidget, itemModel, itemNode) {
	Mojo.Log.info("in rendered callback");
	var id = itemModel.id;
	
	this.controller.setupWidget('shareCheckbox' + id, {}, this.shareCheckboxModels[id]);
	this.controller.setupWidget('drawerButton' + id,
		{
			label: '+'
		}
	);
	this.controller.setupWidget('personDrawer' + id, {}, {open:false});
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
 * Handles a tap on the list of people, which will open or close a person's drawer.
 */
EditeventAssistant.prototype.handlePeopleTap = function(event) {
	$('personDrawer' + event.item.id).mojo.toggleState();
}

/**
 * Handles a change to the subtotal field.
 */
EditeventAssistant.prototype.subtotalChanged = function(event) {
Mojo.Log.info("subtotal value is",event.value);
	var subtotal = parseFloat(event.value);
Mojo.Log.info("subtotal float is",subtotal);
	if (subtotal != Number.NaN) {
		this.ddEvent.setSubtotal(Math.floor(subtotal * 100));
Mojo.Log.info("subtotal field is", this.ddEvent.getSubtotal());
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

/**
 * Updates the event money fields.
 */
EditeventAssistant.prototype.updateEventTotals = function() {
	var tipPercent = this.ddEvent.getTipPercent();
	var tipAmount = this.ddEvent.getTipAmount();
	var subtotal = this.ddEvent.getSubtotal();
	var total = this.ddEvent.getTotal();
	$('tipPercent').mojo.setValue(tipPercent ? tipPercent : null);
	$('subtotal').mojo.setValue(subtotal ? this.formatDecimal(subtotal) : '');
	$('total').mojo.setValue(total ? this.formatDecimal(total) : '');
	$('tipAmount').innerHTML = tipAmount ? ('(' + this.formatTotal(tipAmount) + ')') : '';
}
