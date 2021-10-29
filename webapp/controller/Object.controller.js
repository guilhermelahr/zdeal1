sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"../model/formatter",
	"sap/m/ColumnListItem",
	"sap/ui/core/Fragment"
], function (BaseController, JSONModel, formatter, ColumnListItem, Fragment) {
	"use strict";

	return BaseController.extend("com.wb.zdeal1.zdeal1.controller.Object", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function () {
			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			var iOriginalBusyDelay,
				oViewModel = new JSONModel({
					busy: true,
					delay: 0,
					draft: true
				});

			this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);

			// Store original busy indicator delay, so it can be restored later on
			iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();
			this.setModel(oViewModel, "objectView");
			this.getOwnerComponent().getModel().metadataLoaded().then(function () {
				// Restore original busy indicator delay for the object view
				oViewModel.setProperty("/delay", iOriginalBusyDelay);
			});
			
			this._oDraft = this.getView().byId("idDraftInd");
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		completedHandler: function () {

		},

		handleCancelPopover: function (oEvent) {
			var oButton = oEvent.getSource(),
				oView = this.getView();

			if (!this._pPopover) {
				this._pPopover = Fragment.load({
					id: oView.getId(),
					name: "com.wb.zdeal1.zdeal1.view.Popover",
					controller: this
				}).then(function (oPopover) {
					oView.addDependent(oPopover);
					return oPopover;
				});
			}
			this._pPopover.then(function (oPopover) {
				oPopover.openBy(oButton);
			});
		},

		onDiscard: function () {

			const sPath = this.getView().getBindingContext().getPath();
			let oContext = this.getView().getBindingContext();
			let sActiveUUID = oContext.getProperty("ActiveUUID");
			let oModel = this.getModel(); 

			oModel.attachEventOnce("requestCompleted", function (a) {
				
				this._oDraft.clearDraftState();

				if (sActiveUUID == "00000000-0000-0000-0000-000000000000") {
					this.getRouter().navTo("worklist");
				} else {

					let sObjectPath = oModel.createKey("ZC_Gui_HeaderTP", {
						uuid: sActiveUUID,
						IsActiveEntity: true
					});

					this._editMode('true');
					this._bindView("/" + sObjectPath);

				}

			}.bind(this));

			oModel.remove(sPath, {
				refreshAfterChange: true
			});

		},

		onDelete: function () {

			let oContext = this.getView().byId("table").getSelectedItem();

			if (oContext) {
				const sPath = oContext.getBindingContextPath();
				this.getModel().remove(sPath);
			}

		},

		//Edit non draft register
		onEdit: function () {

			//execute the statment bellow if the entity is NOT draft
			var oModel = this.getModel();
			let oContext = this.getView().getBindingContext();
			const sUuid = oContext.getProperty("uuid");
			const sIsActiveEntity = oContext.getProperty("IsActiveEntity");

			if (sIsActiveEntity) {

				oModel.attachEventOnce("requestCompleted", function (a) {

					let sResponse = a.getParameters().response.responseText;
					let oDraftModel = JSON.parse(sResponse);
					const sNewUuid = oDraftModel.d.uuid;
					const sNewIsActiveEntity = oDraftModel.d.IsActiveEntity;

					var sObjectPath = oModel.createKey("ZC_Gui_HeaderTP", {
						uuid: sNewUuid,
						IsActiveEntity: sNewIsActiveEntity
					});

					//control buttons and input fields
					this._editMode(sNewIsActiveEntity);

					this._bindView("/" + sObjectPath);

					this._oDraft.showDraftSaved();

				}.bind(this));
				
				this._oDraft.showDraftSaving();

				oModel.callFunction("/ZC_Gui_HeaderTPEdit", {
					method: "POST",
					refreshAfterChange: false,
					urlParameters: {
						PreserveChanges: true,
						uuid: sUuid,
						IsActiveEntity: sIsActiveEntity
					}
				});

			}

		},
		
		onLiveChange: function() {
			this._oDraft.clearDraftState();
		},

		//save as draft
		onSave: function () {
			let oModel = this.getModel();

			if (oModel.hasPendingChanges()) {

				this._oDraft.showDraftSaving();

				oModel.submitChanges({
					success: function (a, v) {
						this._oDraft.showDraftSaved();
					}.bind(this)
				});

			}
		},

		//create an item
		onCreate: function () {

			let oModel = this.getModel();
			const sPath = this.getView().getBindingContext().getPath() + "/to_item"; //path to item

			oModel.create(sPath, {}, {
				refreshAfterChange: true
			});

		},

		//submit draft register, becoming a non draft register
		onSubmit: function () {

			let oModel = this.getModel();
			let oContext = this.getView().getBindingContext();
			const sUuid = oContext.getProperty("uuid");
			const sIsActiveEntity = oContext.getProperty("IsActiveEntity");
			var sActiveUUID = oContext.getProperty("ActiveUUID");

			var aDeffGroup = oModel.getDeferredGroups();
			var aDeffGroupBkp = JSON.parse(JSON.stringify(aDeffGroup));

			aDeffGroup.push("group1");
			oModel.setDeferredGroups(aDeffGroup);

			oModel.callFunction("/ZC_Gui_HeaderTPPreparation", {
				method: "POST",
				groupId: "group1",
				changeSetId: "changeSetId1",
				refreshAfterChange: false,
				urlParameters: {
					uuid: sUuid,
					IsActiveEntity: sIsActiveEntity
				}
			});

			oModel.callFunction("/ZC_Gui_HeaderTPActivation", {
				method: "POST",
				groupId: "group1",
				changeSetId: "changeSetId2",
				refreshAfterChange: false,
				urlParameters: {
					uuid: sUuid,
					IsActiveEntity: sIsActiveEntity
				}
			});

			oModel.submitChanges({
				groupId: "group1",
				refreshAfterChange: false,
				success: function (a, b, c) {
					
					this._oDraft.clearDraftState();

					let sUuid;
					if (sActiveUUID == "00000000-0000-0000-0000-000000000000") {
						sUuid = a.__batchResponses[1].__changeResponses[0].data.uuid;
					} else {
						sUuid = sActiveUUID;
					}

					var sObjectPath = oModel.createKey("ZC_Gui_HeaderTP", {
						uuid: sUuid,
						IsActiveEntity: true
					});

					this._editMode('true');

					this._bindView("/" + sObjectPath);

					oModel.setDeferredGroups(aDeffGroupBkp);
					oModel.refresh();

				}.bind(this)
			});

		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */

		_editMode: function (sIsActive) {
			if (String(sIsActive).toLowerCase() === 'true') {
				this.getModel("objectView").setProperty("/draft", false);
			} else {
				this.getModel("objectView").setProperty("/draft", true);
			}
		},

		_onObjectMatched: function (oEvent) {

			var sObjectId = oEvent.getParameter("arguments").objectId;
			var sIsActiveEntity = oEvent.getParameter("arguments").IsActiveEntity;

			//control buttons and input fields
			this._editMode(sIsActiveEntity);

			//bind the element to the view
			this.getModel().metadataLoaded().then(function () {
				var sObjectPath = this.getModel().createKey("ZC_Gui_HeaderTP", {
					uuid: sObjectId,
					IsActiveEntity: sIsActiveEntity
				});
				this._bindView("/" + sObjectPath);
			}.bind(this));
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound
		 * @private
		 */
		_bindView: function (sObjectPath) {
			var oViewModel = this.getModel("objectView"),
				oDataModel = this.getModel();

			this.getView().bindElement({
				path: sObjectPath,
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function () {
						oDataModel.metadataLoaded().then(function () {
							// Busy indicator on view should only be set if metadata is loaded,
							// otherwise there may be two busy indications next to each other on the
							// screen. This happens because route matched handler already calls '_bindView'
							// while metadata is loaded.
							oViewModel.setProperty("/busy", true);
						});
					},
					dataReceived: function () {
						oViewModel.setProperty("/busy", false);
					}
				}
			});
		},

		_onBindingChange: function () {
			var oView = this.getView(),
				oViewModel = this.getModel("objectView"),
				oElementBinding = oView.getElementBinding();

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("objectNotFound");
				return;
			}

			var oResourceBundle = this.getResourceBundle(),
				oObject = oView.getBindingContext().getObject(),
				sObjectId = oObject.uuid,
				sObjectName = oObject.document;

			oViewModel.setProperty("/busy", false);
			// Add the object page to the flp routing history
			this.addHistoryEntry({
				title: this.getResourceBundle().getText("objectTitle") + " - " + sObjectName,
				icon: "sap-icon://enter-more",
				intent: "#Deal-display&/ZC_Gui_HeaderTP/" + sObjectId
			});
			
			this._oDraft.clearDraftState();

		}

	});

});