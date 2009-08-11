/**
 * Manages registration and cleanup of event handlers.
 *
 * Instantiate this class in a scene assistant's setup function. Then,
 * instead of calling Mojo.Event.listen or this.controller.listen, call
 * the listen method on this object.
 *
 * In the activate method, call this object's "activateHandlers" method.
 * In the deactivate method, call this object's "deactivateHandlers" method.
 */
var EventManager = Class.create({
	initialize: function(sceneController) {
		this.eventHandlers = [];
		this.isActive = false;
		this.sceneController = sceneController;
	},

	/**
	 * Adds an event handler. If the event manager is currently active,
	 * also starts listening for the event immediately.
	 */
	listen: function(target, eventType, handler, useCapture) {
		this.eventHandlers.push([target, eventType, handler, useCapture]);
		if (this.isActive) {
			this.sceneController.listen(target, eventType, handler, useCapture);
		}
	},

	/**
	 * Activates the events managed by this handler.
	 */
	activateHandlers: function() {
		if (this.isActive) {
			throw "Event manager is already active; can't activate twice";
		}
		this.isActive = true;
		for (var i = 0; i < this.eventHandlers.length; i++) {
			var args = this.eventHandlers[i];
			this.sceneController.listen.apply(this.sceneController, args);
		}
	},

	/**
	 * Deactivates the events managed by this handler.
	 */
	deactivateHandlers: function() {
		if (!this.isActive) {
			throw "Event manager is already inactive; can't deactivate twice";
		}
		this.isActive = false;
		for (var i = 0; i < this.eventHandlers.length; i++) {
			var args = this.eventHandlers[i];
			this.sceneController.stopListening.apply(this.sceneController, args);
		}
	},
});
