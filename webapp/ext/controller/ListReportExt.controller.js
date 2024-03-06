sap.ui.define([
    "sap/m/MessageToast",
    "sap/ndc/BarcodeScanner"
], function (MessageToast, BarcodeScanner) {
    'use strict';

    return {

        onAfterRendering: function (oEvent) {
            // let oTable = this.templateBaseExtension.getExtensionAPI().getTable()
        },

        createDialog: function (oView, sFragment) {
            return sap.ui.core.Fragment.load({
                id: oView.getId(),
                name: sFragment,
                controller: this
            }).then(function (oDialog) {
                oView.addDependent(oDialog);
                return oDialog;
            }.bind(this));
        },

        onClose: function (oEvent) {
            let oDialog = this.getView().byId("idDialog")
            oDialog.close();
            oDialog.destroy();
            this.getView().removeAllDependents();
        },

        onOpenScan: function (oEvent) {
            this.createDialog(this.getView(), "br.com.nadirfigueiredo.coletoruserdecision.ext.view.BarcodeScanner").then(function (oDialog) {
                oDialog.open()
                oDialog.getParent().byId("idBarcode").focus()
            })
        },

        onScan: function (oEvent) {
            this.onClose()
            let that = this
            let oObject = this.templateBaseExtension.getExtensionAPI().getSelectedContexts()[0].getObject()
            BarcodeScanner.scan(
                function (oResult) {
                    BarcodeScanner.closeScanDialog()
                    that._onScanCallback(oObject, oResult.newValue)
                }.bind(this),
                function (oError) {
                    BarcodeScanner.closeScanDialog()
                    return oResult.newValue
                },
                function (oResult) {
                    BarcodeScanner.closeScanDialog()
                    that._onScanCallback(oObject, oResult.newValue)
                }.bind(this)
            )
        },

        onLiveChange: function (oEvent) {
            let that = this
            let oApi = this.templateBaseExtension.getExtensionAPI()
            let oObject = oApi.getSelectedContexts()[0].getObject()
            let oView = this.getView()
            let oDialog = this.getView().byId("idDialog")

            oEvent.getSource().setValueState("None")
            oEvent.getSource().setValueStateText("")

            if (oEvent.getSource().getValue().length < 12) {
                oEvent.getSource().setValueState("Warning")
                oEvent.getSource().setValueStateText(this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("InspLot"))
                return
            }

            oDialog.setBusy(true)
            this.getView().getModel().callFunction('/setUserDecision',
                {
                    refreshAfterChange: true,
                    method: 'POST',
                    urlParameters: {
                        Plant: oObject.Plant,
                        InspectionLot: oObject.InspectionLot
                    },
                    success: function (oData, response) {
                        oDialog.setBusy(false)
                        oDialog.getEndButton().firePress()
                        // oApi.refreshTable()

                        try {
                            that.showMessages(that.buildMessages(JSON.parse(response.data.__batchResponses[0].__changeResponses[0].headers["sap-message"])))
                        } catch (error) {
                            that.showMessages(that.buildMessages(JSON.parse(response.headers["sap-message"])))
                        }

                        // let oReturn = JSON.parse(response.headers["sap-message"])

                        // switch (oReturn.severity) {
                        //     case 'error':
                        //         sap.m.MessageBox.error(oReturn.message)
                        //         break;
                        //     case 'success':
                        //         sap.m.MessageBox.success(oReturn.message)
                        //         break;
                        //     case 'warning':
                        //         sap.m.MessageBox.alert(oReturn.message)
                        //         break;
                        //     default:
                        //         break;
                        // }
                    },
                    error: function (error) {
                        oDialog.setBusy(false)
                        oDialog.getEndButton().firePress()
                        oApi.refreshTable()
                    }
                }
            )
        },

        showMessages: function (oMessage) {
            let oMessageView = new sap.m.MessageView({
                showDetailsPageHeader: false,
                itemSelect: function (oEvent) {
                    //debugger
                    oEvent.getSource().getParent().getCustomHeader().getContentLeft()[0].setVisible(true);
                },
                items: {
                    path: "/",
                    template: new sap.m.MessageItem({
                        type: "{= ${severity} === 'error' ? 'Error' : 'Success' }",
                        title: "{message}",
                        description: "{code}",
                        subtitle: "{target}"
                    })
                }
            });
            oMessageView.setModel(new sap.ui.model.json.JSONModel(oMessage));
            new sap.m.Dialog({
                resizable: true,
                type: "Message",
                icon: "sap-icon://message-information",
                title: "Mensagens",
                state: "Information",
                contentHeight: "50%",
                contentWidth: "50%",
                verticalScrolling: false,
                content: oMessageView,
                beginButton: new sap.m.Button({
                    press: function (oEvent) {
                        this.getParent().close();
                    },
                    text: "Fechar"
                }),
                customHeader: new sap.m.Bar({
                    contentLeft: [new sap.m.Button({
                        icon: "sap-icon://nav-back",
                        visible: false,
                        press: function (oEvent) {
                            oMessageView.navigateBack();
                            this.setVisible(false);
                        }
                    })],
                    contentMiddle: [
                        new sap.m.Title({
                            text: "{i18n>MessageTitle}",
                            level: sap.ui.core.TitleLevel.H1
                        })
                    ]
                })
            }).open();
        },

        buildMessages: function (oMessage) {
            let aMessage = []

            try {
                aMessage.push(JSON.parse(oMessage, Object.keys(oMessage).filter((k) => k !== "details")))
                aMessage = aMessage.concat(JSON.parse(oMessage).details)
            } catch (error) {
                aMessage.push(JSON.parse(JSON.stringify(oMessage, Object.keys(oMessage).filter((k) => k !== "details"))))
                aMessage = aMessage.concat(JSON.parse(JSON.stringify(oMessage)).details)
            }

            return [...new Set(aMessage)]
        },

        _onScanCallback: function (oObject, sValue) {
            let oApi = this.templateBaseExtension.getExtensionAPI()
            let oView = this.getView()

            oView.setBusy(true)

            BarcodeScanner.closeScanDialog()

            this.getView().getModel().callFunction('/setUserDecision',
                {
                    refreshAfterChange: true,
                    method: 'POST',
                    urlParameters: {
                        Plant: oObject.Plant,
                        InspectionLot: oObject.InspectionLot
                    },
                    success: function (oData, response) {
                        oView.setBusy(false)
                        oApi.refreshTable()

                        let oReturn = JSON.parse(response.headers["sap-message"])

                        switch (oReturn.severity) {
                            case 'error':
                                sap.m.MessageBox.error(oReturn.message)
                                break;
                            case 'success':
                                sap.m.MessageBox.success(oReturn.message)
                                break;
                            case 'warning':
                                sap.m.MessageBox.alert(oReturn.message)
                                break;
                            default:
                                break;
                        }

                    },
                    error: function (error) {
                        oView.setBusy(false)
                        oApi.refreshTable()
                    }
                }
            )
        }
    };
});