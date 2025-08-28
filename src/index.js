import iziToast from "izitoast";
let keyEventHandler = undefined;
var observer, targetNode1, targetNode2, obsConfig = undefined;
let parentUid = undefined;
var TodoistHeader, key, TodoistOverdue, TodoistCompleted, autoParentUid, autoBlockUid, existingItems, TodoistAccount, TodoistPriority, TodoistGetDescription, TodoistGetComments, TodoistGetSubtasks;
var checkTDInterval = 0;
var checkEveryMinutes = 15;
var auto = false;
var completedStrikethrough;
var RRTag = undefined;
var advancedChildManagement = false;
var isImportRunning = false;

// copied and adapted from https://github.com/dvargas92495/roamjs-components/blob/main/src/writes/createBlock.ts
const createBlock = (params) => {
    const uid = window.roamAlphaAPI.util.generateUID();
    return Promise.all([
        window.roamAlphaAPI.createBlock({
            location: {
                "parent-uid": params.parentUid,
                order: params.order,
            },
            block: {
                uid,
                string: params.node.text
            }
        })
    ].concat((params.node.children || []).map((node, order) =>
        createBlock({ parentUid: uid, order, node })
    )))
};

const FormDialog = ({
    onSubmit,
    title,
    onClose,
}) => {
    var today = new Date;
    const [scheduleDate, setScheduleDate] = window.React.useState(today);

    const onChange = window.React.useCallback(
        (date) => {
            onSubmit(date);
            onClose();
        },
        [setScheduleDate, onClose]
    );
    const onCancel = window.React.useCallback(
        () => {
            onSubmit("");
            onClose();
        },
        [onClose]
    )
    return window.React.createElement(
        window.Blueprint.Core.Dialog,
        { isOpen: true, enforceFocus: false, onClose: onCancel, title, },
        window.React.createElement(
            "div",
            { className: window.Blueprint.Core.Classes.DIALOG_BODY },
            window.React.createElement(
                window.Blueprint.Core.Label,
                {},
                window.React.createElement(
                    window.Blueprint.DateTime.DatePicker,
                    {
                        onChange: onChange,
                        highlightCurrentDay: true,
                        popoverProps: {
                            minimal: true,
                            captureDismiss: true,
                        }
                    }
                )
            )
        )
    );
}

const prompt = ({
    title,
}) =>
    new Promise((resolve) => {
        const app = document.getElementById("app");
        const parent = document.createElement("div");
        parent.id = 'todoist-prompt-root';
        app.parentElement.appendChild(parent);

        window.ReactDOM.render(
            window.React.createElement(
                FormDialog,
                {
                    onSubmit: resolve,
                    title,
                    onClose: () => {
                        window.ReactDOM.unmountComponentAtNode(parent);
                        parent.remove();
                    }
                }
            ),
            parent
        )
    });

export default {
    onload: ({ extensionAPI }) => {
        const config = {
            tabTitle: "Todoist Task Management",
            settings: [
                {
                    id: "ttt-token",
                    name: "Todoist API Token",
                    description: "Your API token from https://todoist.com/app/settings/integrations",
                    action: { type: "input", placeholder: "Add Todoist API token here" },
                },
                {
                    id: "ttt-import-header",
                    name: "Roam Research Header",
                    description: "Text Header for Roam Research on import",
                    action: { type: "input", placeholder: "Imported Tasks" },
                },
                {
                    id: "ttt-account",
                    name: "Account type",
                    description: "Account type - turn on if subscribed to Todoist Premium",
                    action: { type: "switch" },
                },
                {
                    id: "ttt-overdue",
                    name: "Include Overdue",
                    description: "Include tasks that are overdue in Today's tasks",
                    action: { type: "switch" },
                },
                {
                    id: "ttt-intermediate",
                    name: "Show Intermediate options",
                    description: "Show more configuration options",
                    action: {
                        type: "switch",
                        onChange: (evt) => { setConfig(evt, 1); }
                    },
                },
                {
                    id: "ttt-advanced",
                    name: "Show Advanced options (beta)",
                    description: "Show advanced configuration options",
                    action: {
                        type: "switch",
                        onChange: (evt) => { setConfig(evt, 2); }
                    },
                }
            ]
        };
        const config1 = {
            tabTitle: "Todoist Task Management",
            settings: [
                {
                    id: "ttt-token",
                    name: "Todoist API Token",
                    description: "Your API token from https://todoist.com/app/settings/integrations",
                    action: { type: "input", placeholder: "Add Todoist API token here" },
                },
                {
                    id: "ttt-import-header",
                    name: "Roam Research Header",
                    description: "Text Header for Roam Research on import",
                    action: { type: "input", placeholder: "Imported Tasks" },
                },
                {
                    id: "ttt-account",
                    name: "Account type",
                    description: "Account type - turn on if subscribed to Todoist Premium",
                    action: { type: "switch" },
                },
                {
                    id: "ttt-overdue",
                    name: "Include Overdue",
                    description: "Include tasks that are overdue in Today's tasks",
                    action: { type: "switch" },
                },
                {
                    id: "ttt-intermediate",
                    name: "Show Intermediate options",
                    description: "Show more configuration options",
                    action: {
                        type: "switch",
                        onChange: (evt) => { setConfig(evt, 1); }
                    },
                },
                {
                    id: "ttt-auto",
                    name: "Automatic Download",
                    description: "Import items to the DNP automatically",
                    action: {
                        type: "switch",
                        onChange: (evt) => { setAuto(evt, 1); }
                    },
                },
                {
                    id: "ttt-auto-time",
                    name: "Automatic Download interval",
                    description: "Frequency in minutes to check for new items",
                    action: {
                        type: "input", placeholder: "15",
                        onChange: (evt) => { setAuto(evt, 2); }
                    },
                },
                {
                    id: "ttt-completed",
                    name: "Include Completed",
                    description: "Include completed tasks in Today's tasks",
                    action: { type: "switch" },
                },
                {
                    id: "ttt-completedStrikethrough",
                    name: "Strikethrough Completed Tasks",
                    description: "Strikethrough task content upon completion",
                    action: { type: "switch" },
                },
                {
                    id: "ttt-description",
                    name: "Description",
                    description: "Import item description",
                    action: { type: "switch" },
                },
                {
                    id: "ttt-subtasks",
                    name: "Subtasks",
                    description: "Import item subtasks",
                    action: { type: "switch" },
                },
                {
                    id: "ttt-comments",
                    name: "Comments",
                    description: "Import item comments",
                    action: { type: "switch" },
                },
                {
                    id: "ttt-priority",
                    name: "Priority",
                    description: "Import item priority",
                    action: { type: "switch" },
                },
                {
                    id: "ttt-createLink",
                    name: "Link in Created Task",
                    description: "Create a link to the Roam block in newly created Todoist tasks",
                    action: { type: "switch" },
                },
                {
                    id: "ttt-advanced",
                    name: "Show Advanced options (beta)",
                    description: "Show advanced configuration options",
                    action: {
                        type: "switch",
                        onChange: (evt) => { setConfig(evt, 2); }
                    },
                }
            ]
        };
        const config2 = {
            tabTitle: "Todoist Task Management",
            settings: [
                {
                    id: "ttt-token",
                    name: "Todoist API Token",
                    description: "Your API token from https://todoist.com/app/settings/integrations",
                    action: { type: "input", placeholder: "Add Todoist API token here" },
                },
                {
                    id: "ttt-import-header",
                    name: "Roam Research Header",
                    description: "Text Header for Roam Research on import",
                    action: { type: "input", placeholder: "Imported Tasks" },
                },
                {
                    id: "ttt-account",
                    name: "Account type",
                    description: "Account type - turn on if subscribed to Todoist Premium",
                    action: { type: "switch" },
                },
                {
                    id: "ttt-overdue",
                    name: "Include Overdue",
                    description: "Include tasks that are overdue in Today's tasks",
                    action: { type: "switch" },
                },
                {
                    id: "ttt-intermediate",
                    name: "Show Intermediate options",
                    description: "Show more configuration options",
                    action: {
                        type: "switch",
                        onChange: (evt) => { setConfig(evt, 1); }
                    },
                },
                {
                    id: "ttt-auto",
                    name: "Automatic Download",
                    description: "Import items to the DNP automatically",
                    action: {
                        type: "switch",
                        onChange: (evt) => { setAuto(evt, 1); }
                    },
                },
                {
                    id: "ttt-auto-time",
                    name: "Automatic Download interval",
                    description: "Frequency in minutes to check for new items",
                    action: {
                        type: "input", placeholder: "15",
                        onChange: (evt) => { setAuto(evt, 2); }
                    },
                },
                {
                    id: "ttt-completed",
                    name: "Include Completed",
                    description: "Include completed tasks in Today's tasks",
                    action: { type: "switch" },
                },
                {
                    id: "ttt-completedStrikethrough",
                    name: "Strikethrough Completed Tasks",
                    description: "Strikethrough task content upon completion",
                    action: { type: "switch" },
                },
                {
                    id: "ttt-description",
                    name: "Description",
                    description: "Import item description",
                    action: { type: "switch" },
                },
                {
                    id: "ttt-subtasks",
                    name: "Subtasks",
                    description: "Import item subtasks",
                    action: { type: "switch" },
                },
                {
                    id: "ttt-comments",
                    name: "Comments",
                    description: "Import item comments",
                    action: { type: "switch" },
                },
                {
                    id: "ttt-priority",
                    name: "Priority",
                    description: "Import item priority",
                    action: { type: "switch" },
                },
                {
                    id: "ttt-createLink",
                    name: "Link in Created Task",
                    description: "Create a link to the Roam block in newly created Todoist tasks",
                    action: { type: "switch" },
                },
                {
                    id: "ttt-advanced",
                    name: "Show Advanced options (beta)",
                    description: "Show advanced configuration options",
                    action: {
                        type: "switch",
                        onChange: (evt) => { setConfig(evt, 2); }
                    },
                },
                {
                    id: "ttt-advChildFeat",
                    name: "Advanced Sync features (beta)",
                    description: "Turn on to automatically create tasks, subtasks and comments from within Roam Research",
                    action: {
                        type: "switch",
                        onChange: (evt) => { setAdvFeat(evt); }
                    },
                },
            ]
        };
        const config3 = {
            tabTitle: "Todoist Task Management",
            settings: [
                {
                    id: "ttt-token",
                    name: "Todoist API Token",
                    description: "Your API token from https://todoist.com/app/settings/integrations",
                    action: { type: "input", placeholder: "Add Todoist API token here" },
                },
                {
                    id: "ttt-import-header",
                    name: "Roam Research Header",
                    description: "Text Header for Roam Research on import",
                    action: { type: "input", placeholder: "Imported Tasks" },
                },
                {
                    id: "ttt-account",
                    name: "Account type",
                    description: "Account type - turn on if subscribed to Todoist Premium",
                    action: { type: "switch" },
                },
                {
                    id: "ttt-overdue",
                    name: "Include Overdue",
                    description: "Include tasks that are overdue in Today's tasks",
                    action: { type: "switch" },
                },
                {
                    id: "ttt-intermediate",
                    name: "Show Intermediate options",
                    description: "Show more configuration options",
                    action: {
                        type: "switch",
                        onChange: (evt) => { setConfig(evt, 1); }
                    },
                },
                {
                    id: "ttt-advanced",
                    name: "Show Advanced options (beta)",
                    description: "Show advanced configuration options",
                    action: {
                        type: "switch",
                        onChange: (evt) => { setConfig(evt, 2); }
                    },
                },
                {
                    id: "ttt-advChildFeat",
                    name: "Advanced Sync features (beta)",
                    description: "Turn on to automatically create tasks, subtasks and comments from within Roam Research",
                    action: {
                        type: "switch",
                        onChange: (evt) => { setAdvFeat(evt); }
                    },
                },
            ]
        };

        // onload config options
        if (extensionAPI.settings.get("ttt-intermediate")) {
            if (extensionAPI.settings.get("ttt-advanced")) {
                extensionAPI.settings.panel.create(config2);
            } else {
                extensionAPI.settings.panel.create(config1);
            }
        } else if (extensionAPI.settings.get("ttt-advanced")) {
            extensionAPI.settings.panel.create(config3);
        } else {
            extensionAPI.settings.panel.create(config);
        }

        extensionAPI.ui.commandPalette.addCommand({
            label: "Import tasks from Todoist",
            callback: () => {
                const uid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
                importTodoistTasks(false, false).then(async (blocks) => {
                    if (uid == undefined) {
                        parentUid = await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
                        if (parentUid == null) { // check for log page
                            var uri = window.location.href;
                            const regex = /^https:\/\/roamresearch.com\/.+\/(app|offline)\/\w+$/; // log page
                            if (regex.test(uri)) { // definitely a log page, so get the corresponding page uid
                                var today = new Date();
                                var dd = String(today.getDate()).padStart(2, '0');
                                var mm = String(today.getMonth() + 1).padStart(2, '0');
                                var yyyy = today.getFullYear();
                                parentUid = mm + '-' + dd + '-' + yyyy;
                            }
                        }
                        var thisBlock = window.roamAlphaAPI.util.generateUID();
                        await window.roamAlphaAPI.createBlock({
                            location: { "parent-uid": parentUid, order: 0 },
                            block: { string: TodoistHeader.toString(), uid: thisBlock }
                        });
                        parentUid = thisBlock;
                        blocks.forEach((node, order) => createBlock({
                            parentUid,
                            order,
                            node
                        }));
                    } else {
                        parentUid = uid;
                        await window.roamAlphaAPI.updateBlock(
                            { block: { uid: parentUid, string: TodoistHeader.toString(), open: true } });

                        if (blocks != undefined) {
                            blocks.forEach((node, order) => createBlock({
                                parentUid,
                                order,
                                node
                            }));
                        }
                    }
                });
            },
        });

        const args = {
            text: "IMPORTTODOIST",
            help: "Import tasks from Todoist",
            handler: (context) => importTodoistTasksSB,
        };

        if (window.roamjs?.extension?.smartblocks) {
            window.roamjs.extension.smartblocks.registerCommand(args);
        } else {
            document.body.addEventListener(
                `roamjs:smartblocks:loaded`,
                () =>
                    window.roamjs?.extension.smartblocks &&
                    window.roamjs.extension.smartblocks.registerCommand(args)
            );
        }

        extensionAPI.ui.commandPalette.addCommand({
            label: "Create task in Todoist",
            callback: () => createTodoistTask(),
        });
        extensionAPI.ui.commandPalette.addCommand({
            label: "Link a Todoist project",
            callback: () => {
                linkTodoistProject().then(async (blocks) => {
                    if (blocks != null) {
                        var uid = await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
                        if (uid == null) { // check for log page
                            var uri = window.location.href;
                            const regex = /^https:\/\/roamresearch.com\/.+\/(app|offline)\/\w+$/; // log page
                            if (regex.test(uri)) { // definitely a log page, so get the corresponding page uid
                                var today = new Date();
                                var dd = String(today.getDate()).padStart(2, '0');
                                var mm = String(today.getMonth() + 1).padStart(2, '0');
                                var yyyy = today.getFullYear();
                                uid = mm + '-' + dd + '-' + yyyy;
                            }
                        }
                        var thisBlock = window.roamAlphaAPI.util.generateUID();
                        await window.roamAlphaAPI.createBlock({
                            location: { "parent-uid": uid, order: 0 },
                            block: { string: TodoistHeader.toString(), uid: thisBlock }
                        });
                        parentUid = thisBlock;
                        blocks.forEach((node, order) => createBlock({
                            parentUid,
                            order,
                            node
                        }));
                    }
                });
            }
        });
        extensionAPI.ui.commandPalette.addCommand({
            label: "Reschedule task(s) in Todoist",
            callback: () => moveTask(),
        });
        window.roamAlphaAPI.ui.blockContextMenu.addCommand({
            label: "Reschedule task(s) in Todoist",
            callback: (e) => moveTask(e),
        });

        // onload
        if (extensionAPI.settings.get("ttt-auto") == true) {
            auto = true;
            autoDL();
        }
        if (extensionAPI.settings.get("ttt-import-header")) {
            TodoistHeader = extensionAPI.settings.get("ttt-import-header");
        } else {
            TodoistHeader = "Imported tasks";
        }

        if (extensionAPI.settings.get("ttt-advChildFeat") == true) {
            advancedChildManagement = true;
        }

        // onchange
        async function setAuto(evt, i) {
            if (i == 1) {
                if (evt.target.checked) {
                    auto = true;
                    autoDL();
                } else {
                    auto = false;
                    clearInterval(checkTDInterval);
                }
            } else if (i == 2) {
                if (evt.target.value != "") {
                    clearInterval(checkTDInterval);
                    checkEveryMinutes = parseInt(evt.target.value);
                    if (auto == true) {
                        autoDL();
                    }
                } else {
                    clearInterval(checkTDInterval);
                }
            }
        }

        async function setAdvFeat(evt) {
            if (evt.target.checked) {
                advancedChildManagement = true;
            } else {
                advancedChildManagement = false;
            }
        }

        async function setConfig(evt, i) {
            if (i == 1) {
                if (evt.target.checked) {
                    if (extensionAPI.settings.get("ttt-advanced")) {
                        extensionAPI.settings.panel.create(config2);
                    } else {
                        extensionAPI.settings.panel.create(config1);
                    }
                } else {
                    if (extensionAPI.settings.get("ttt-advanced")) {
                        extensionAPI.settings.panel.create(config3);
                    } else {
                        extensionAPI.settings.panel.create(config);
                    }
                }
            } else if (i == 2) {
                if (evt.target.checked) {
                    if (extensionAPI.settings.get("ttt-intermediate")) {
                        extensionAPI.settings.panel.create(config2);
                    } else {
                        extensionAPI.settings.panel.create(config3);
                    }
                } else {
                    if (extensionAPI.settings.get("ttt-intermediate")) {
                        extensionAPI.settings.panel.create(config1);
                    } else {
                        extensionAPI.settings.panel.create(config);
                    }
                }
            }
        }

        initiateObserver();

        keyEventHandler = function (e) {
            if (e.code === 'KeyI' && e.shiftKey && e.altKey) {
                return importTodoistTasks();
            }
        }
        window.addEventListener('keydown', keyEventHandler, false);

        async function initiateObserver() {
            targetNode1 = document.getElementsByClassName("roam-main")[0];
            targetNode2 = document.getElementById("right-sidebar");
            obsConfig = { attributes: false, childList: true, subtree: true };
            const callback = function (mutationsList, observer) {
                for (const mutation of mutationsList) {
                    if (mutation.addedNodes[0]?.childNodes[0]?.childNodes[0]?.control?.checked == true) {
                        if (mutation.addedNodes[0]?.innerHTML?.includes("https://app.todoist.com/app/task")) {
                            observer.disconnect();
                            var taskString = mutation.addedNodes[0]?.innerText?.trim();
                            taskString = taskString.split(" Link")[0];
                            var taskUrl = mutation.addedNodes[0]?.innerHTML.split("href=\"");
                            var taskUrl2 = taskUrl[1].split("\"");
                            taskUrl = taskUrl2[0];
                            var taskData = mutation.addedNodes[0]?.innerHTML?.split("task/");
                            var regex = /^(\d{9,10})/gm;
                            var taskIDClose = taskData[1].match(regex);
                            var rrUID = mutation.target?.id?.slice(-9);
                            closeTask(taskIDClose, taskString, rrUID, taskUrl);
                        }
                    } else if (mutation.addedNodes[0]?.childNodes[0]?.childNodes[0]?.control?.checked == false) {
                        if (mutation.addedNodes[0]?.innerHTML?.includes("https://app.todoist.com/app/task")) {
                            observer.disconnect();
                            var taskString = mutation.addedNodes[0]?.innerText?.trim();
                            taskString = taskString.split(" Link")[0];
                            var taskUrl = mutation.addedNodes[0]?.innerHTML.split("href=\"");
                            var taskUrl2 = taskUrl[1].split("\"");
                            taskUrl = taskUrl2[0];
                            var taskData = mutation.addedNodes[0]?.innerHTML?.split("task/");
                            var regex = /^(\d{9,10})/gm;
                            var taskIDReopen = taskData[1].match(regex);
                            var rrUID = mutation.target?.id.slice(-9);
                            reopenTask(taskIDReopen, taskString, rrUID, taskUrl);
                        }
                    }
                }
            };
            observer = new MutationObserver(callback);
            observer.observe(targetNode1, obsConfig);
            observer.observe(targetNode2, obsConfig);
        }

        async function importTodoistTasks(auto, SB) {
            breakme: {
                if (!extensionAPI.settings.get("ttt-token")) {
                    key = "API";
                    sendConfigAlert(key);
                    break breakme;
                } else {
                    const myToken = extensionAPI.settings.get("ttt-token");
                    if (!extensionAPI.settings.get("ttt-import-header")) {
                        TodoistHeader = "Imported tasks";
                    } else {
                        TodoistHeader = extensionAPI.settings.get("ttt-import-header");
                    }
                    TodoistOverdue = extensionAPI.settings.get("ttt-overdue");
                    TodoistCompleted = extensionAPI.settings.get("ttt-completed");
                    /*
                    if (extensionAPI.settings.get("ttt-import-tag")) {
                        RRTag = extensionAPI.settings.get("ttt-import-tag");
                    }
                    */
                    TodoistPriority = extensionAPI.settings.get("ttt-priority");
                    TodoistGetDescription = extensionAPI.settings.get("ttt-description");
                    TodoistGetComments = extensionAPI.settings.get("ttt-comments");
                    TodoistGetSubtasks = extensionAPI.settings.get("ttt-subtasks");
                    if (extensionAPI.settings.get("ttt-account")) {
                        TodoistAccount = "Premium";
                    } else {
                        TodoistAccount = "Free";
                    }

                    var projectIDText = "projectID: ";
                    var currentPageUID;
                    var DNP = false;
                    if (auto == true) { // look for header on dated DNP
                        // get today's DNP uid
                        var today = new Date();
                        var dd = String(today.getDate()).padStart(2, '0');
                        var mm = String(today.getMonth() + 1).padStart(2, '0');
                        var yyyy = today.getFullYear();
                        autoParentUid = mm + '-' + dd + '-' + yyyy;
                        // find header
                        var autoBlockUid;
                        let autoBlockUids = await window.roamAlphaAPI.q(`[:find ?u ?s :where [?b :block/page ?p] [?b :block/uid ?u] [?b :block/order ?s] [?b :block/string "${TodoistHeader}"] [?p :block/uid "${autoParentUid}"]]`);

                        if (autoBlockUids != undefined && autoBlockUids.length > 1) {
                            let maxNum = 999;
                            let uid;
                            for (var i = 0; i < autoBlockUids.length; i++) {
                                if (parseInt(autoBlockUids[i][1]) < maxNum) {
                                    maxNum = parseInt(autoBlockUids[i][1]);
                                    if (uid) {
                                        await window.roamAlphaAPI.deleteBlock({ block: { uid: uid } });
                                    }
                                    uid = autoBlockUids[i][0].toString();
                                } else if (parseInt(autoBlockUids[i][1]) > maxNum) {
                                    await window.roamAlphaAPI.deleteBlock({ block: { uid: autoBlockUids[i][0] } });
                                }
                            }
                            autoBlockUid = uid;
                        } else if (autoBlockUids != undefined && autoBlockUids.length == 1) {
                            autoBlockUid = autoBlockUids[0][0].toString();
                        }

                        if (autoBlockUid == undefined) {
                            const uid = window.roamAlphaAPI.util.generateUID();
                            await window.roamAlphaAPI.createBlock({
                                location: { "parent-uid": autoParentUid, order: 9999 },
                                block: { string: TodoistHeader, uid }
                            });
                            autoBlockUid = uid;
                        }

                        currentPageUID = autoParentUid;
                    } else {
                        var startBlock = await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
                        if (!startBlock) {
                            var uri = window.location.href;
                            const regex = /^https:\/\/roamresearch.com\/#\/(app|offline)\/\w+$/; //today's DNP
                            let logPage = document.getElementById("rm-log-container");
                            if (logPage) {
                                var today = new Date();
                                var dd = String(today.getDate()).padStart(2, '0');
                                var mm = String(today.getMonth() + 1).padStart(2, '0');
                                var yyyy = today.getFullYear();
                                startBlock = mm + '-' + dd + '-' + yyyy;
                                DNP = true;
                            }
                            if (regex.test(uri)) { // this is Daily Notes for today
                                var today = new Date();
                                var dd = String(today.getDate()).padStart(2, '0');
                                var mm = String(today.getMonth() + 1).padStart(2, '0');
                                var yyyy = today.getFullYear();
                                startBlock = mm + '-' + dd + '-' + yyyy;
                                DNP = true;
                            }
                        }
                        let q = `[:find (pull ?page [:node/title :block/string :block/uid {:block/children ...} ]) :where [?page :block/uid "${startBlock}"]  ]`;
                        var info = await window.roamAlphaAPI.q(q);
                        if (info.length > 0) {
                            var projectID;
                            if (info[0][0].hasOwnProperty('children')) {
                                for (var i = 0; i < info[0][0]?.children.length; i++) {
                                    if (info[0][0].children[i].string.match(projectIDText)) { // This is a project page
                                        projectID = info[0][0].children[i].string.split(projectIDText);
                                    }
                                }
                            }
                            currentPageUID = info[0][0].uid;
                        }
                    }

                    completedStrikethrough = extensionAPI.settings.get("ttt-completedStrikethrough");
                    return importTasks(myToken, TodoistHeader, TodoistOverdue, TodoistPriority, TodoistGetDescription, projectID, DNP, currentPageUID, auto, autoBlockUid, SB, TodoistCompleted, completedStrikethrough);
                }
            }
        }

        function importTodoistTasksSB() {
            return importTodoistTasks(false, true)
        }

        async function autoDL() {
            console.info("setting automatic download");
            const regex = /^\d{1,2}$/;
            if (regex.test(extensionAPI.settings.get("ttt-auto-time"))) {
                checkEveryMinutes = parseInt(extensionAPI.settings.get("ttt-auto-time"));
            }

            await importTodoistTasks(auto);
            try { if (checkTDInterval > 0) clearInterval(checkTDInterval) } catch (e) { }
            checkTDInterval = setInterval(async () => {
                await importTodoistTasks(auto)
            }, checkEveryMinutes * 60000);
        }

        async function moveTask(e) {
            observer.disconnect();
            var TodoistHeader;
            const myToken = extensionAPI.settings.get("ttt-token");
            if (!extensionAPI.settings.get("ttt-import-header")) {
                TodoistHeader = "Imported tasks";
            } else {
                TodoistHeader = extensionAPI.settings.get("ttt-import-header");
            }
            let uidArray = [];
            const regex = /(\{\{\[\[TODO\]\]\}\})/;
            let uids = await roamAlphaAPI.ui.individualMultiselect.getSelectedUids(); // get multi-selection uids

            if (uids.length === 0) { // not a multi-select query
                var uid, text;
                if (e) { // bullet right-click
                    uid = e["block-uid"].toString();
                    text = e["block-string"].toString();
                } else { // command palette
                    uid = await window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
                    text = await window.roamAlphaAPI.data.pull("[:block/string]", [":block/uid", startBlock]);
                }
                if (text.includes("Task?id=")) { // there's a Todoist task in this block, add uid and text to array
                    uidArray.push({ uid, text })
                } else {
                    alert("You can't reschedule blocks without a Todoist task")
                    return;
                }
            } else {
                for (var i = 0; i < uids.length; i++) {
                    var results = await window.roamAlphaAPI.data.pull("[:block/string]", [":block/uid", uids[i]]);
                    var text = results[":block/string"];
                    if (text.includes("Task?id=")) { // there's a Todoist task in this block
                        let uid = uids[i].toString();
                        uidArray.push({ uid, text })
                    }
                }
            }

            if (uidArray.length > 0) {
                const pageUID = await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
                var selectedDate = await prompt({
                    title: "To which date?",
                });
                if (selectedDate.length < 1) {
                    return;
                }
                let year = selectedDate.getFullYear();
                var dd = String(selectedDate.getDate()).padStart(2, '0');
                var mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                let newDate = mm + "-" + dd + "-" + year;
                var titleDate = convertToRoamDate(newDate);
                var page = await window.roamAlphaAPI.q(`[:find (pull ?e [:node/title]) :where [?e :block/uid "${newDate}"]]`);
                if (page.length > 0 && page[0][0] != null) {
                    // there's already a page with this date
                } else {
                    await window.roamAlphaAPI.createPage({ page: { title: titleDate, uid: newDate } });
                }

                var todoistDate = year + "-" + mm + "-" + dd;
                var taskcontent = '{"due_date": "' + todoistDate + '"}';

                console.info("Rescheduling task(s) in Todoist")
                var myHeaders = new Headers();
                var bearer = 'Bearer ' + myToken;
                myHeaders.append("Authorization", bearer);
                myHeaders.append("Content-Type", "application/json");
                var requestOptions = {
                    method: 'POST',
                    headers: myHeaders,
                    body: taskcontent
                };

                for (var j = 0; j < uidArray.length; j++) {
                    var taskID = uidArray[j].text.slice(-11);
                    taskID = taskID.slice(0, 10);
                    var url = "https://api.todoist.com/rest/v2/tasks/" + taskID + "";

                    const response = await fetch(url, requestOptions);
                    if (!response.ok) {
                        alert("Failed to reschedule task in Todoist");
                    } else {
                        // find Todoist header
                        var headerBlockUid = await window.roamAlphaAPI.q(`[:find ?u :where [?b :block/page ?p] [?b :block/uid ?u] [?b :block/string "${TodoistHeader}"] [?p :block/uid "${newDate}"]]`)?.[0]?.[0];
                        if (headerBlockUid == undefined) { // there isn't a Todoist header on this date yet, so create one
                            const newHeaderUid = window.roamAlphaAPI.util.generateUID();
                            await window.roamAlphaAPI.createBlock({
                                location: { "parent-uid": newDate, order: 0 },
                                block: { string: TodoistHeader.toString(), uid: newHeaderUid }
                            });
                            headerBlockUid = newHeaderUid;
                        }

                        await window.roamAlphaAPI.moveBlock( // move to the new date
                            { location: { "parent-uid": headerBlockUid, order: j }, block: { uid: uidArray[j].uid.toString() } });

                        // check if header on source page has any tasks left beneath it, remove header if none remain
                        var results = await window.roamAlphaAPI.q(`[:find (pull ?page [:node/title :block/string :block/uid {:block/children ...} ]) :where [?page :block/uid "${pageUID}"] ]`);
                        if (results[0][0].hasOwnProperty("children") && results[0][0].children.length > 0) {
                            for (var i = 0; i < results[0][0].children.length; i++) {
                                if (results[0][0].children[i].string == TodoistHeader) {
                                    var headerUid = results[0][0]?.children[i]?.uid;
                                    if (!results[0][0]?.children[i].hasOwnProperty("children")) { // no other tasks under header
                                        await window.roamAlphaAPI.deleteBlock({ block: { uid: headerUid } });
                                    }
                                }
                            }
                        }
                    }
                }
                if (uids.length !== 0) { // turn off block multi-select
                    window.dispatchEvent(new KeyboardEvent('keydown', {
                        key: "m",
                        keyCode: 77,
                        code: "KeyM",
                        which: 77,
                        shiftKey: false,
                        ctrlKey: true,
                        metaKey: false
                    }));
                    window.dispatchEvent(new KeyboardEvent('keyup', {
                        key: "m",
                        keyCode: 77,
                        code: "KeyM",
                        which: 77,
                        shiftKey: false,
                        ctrlKey: true,
                        metaKey: false
                    }));
                }
            }

            initiateObserver(); // restart monitoring for task completions
        }

        async function createTodoistTask(newTaskString, newTaskUid, parentTaskTodoistId, startBlock) {
            var key;
            breakme: {
                if (!extensionAPI.settings.get("ttt-token")) {
                    key = "API";
                    sendConfigAlert(key);
                    break breakme;
                } else {
                    const myToken = extensionAPI.settings.get("ttt-token");
                    const createLinkTodoist = extensionAPI.settings.get("ttt-createLink");

                    // which page am I on?
                    if (startBlock == undefined || startBlock == null) {
                        var startBlock = await window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
                        if (!startBlock) {
                            alert("Your cursor must be within a block to create as a task in Todoist")
                        }
                    }

                    let q = `[:find (pull ?page
                        [:node/title :block/string :block/uid :children/view-type
                         :block/order {:block/children ...} {:block/parents ...}
                        ])
                     :where [?page :block/uid "${startBlock}"]  ]`;
                    var block = await window.roamAlphaAPI.q(q);
                    var projectID;
                    var projectIDText = "projectID: ";

                    const regexContent = /^\{\{\[\[TODO\]\]\}\}.+$/;
                    if (newTaskString != undefined) {
                        if (newTaskString.includes("{{[[TODO]]}}")) {
                            newTaskString1 = newTaskString.split("{{[[TODO]]}}");
                            var taskString = '{"content": "' + newTaskString1[1].trim() + '"';
                        } else {
                            var taskString = '{"content": "' + newTaskString + '"';
                        }
                        if (parentTaskTodoistId != undefined) {
                            taskString += ', "parent_id": "' + parentTaskTodoistId + '"';
                        }
                    } else if (regexContent.test(block[0][0].string)) {
                        var taskContent = block[0][0].string.split("{{[[TODO]]}}");
                        var taskString = '{"content": "' + taskContent[1] + '"';
                    } else {
                        var taskString = '{"content": "' + block[0][0].string + '"';
                    }
                    var url = "https://api.todoist.com/rest/v2/tasks";

                    const regex = /^\d{2}-\d{2}-\d{4}$/;
                    const regex1 = /^https:\/\/roamresearch.com\/#\/(app|offline)\/\w+$/; //today's DNP
                    var uri = window.location.href;
                    if (regex.test(block[0]?.[0]?.parents[0]?.uid)) { // this is a DNP, set a due date
                        var dateString = block[0][0].parents[0].uid.split("-");
                        var todoistDate = dateString[2] + "-" + dateString[0] + "-" + dateString[1];
                        if (createLinkTodoist) {
                            let roamUrl = uri + "/page/" + startBlock;
                            taskString += ', "description": "' + roamUrl + '"';
                        }
                        taskString += ', "due_date": "' + todoistDate + '"}';
                    } else if (block[0][0].parents[0].hasOwnProperty('children')) {
                        if (createLinkTodoist) {
                            let roamUrl = window.location.href.slice(0, -9) + "" + startBlock;
                            taskString += ', "description": "' + roamUrl + '"';
                        }
                        for (var i = 0; i < block[0][0].parents[0]?.children.length; i++) {
                            if (block[0][0].parents[0].children[i].string.match(projectIDText)) { // This is a project page, set a project_id
                                projectID = block[0][0].parents[0].children[i].string.split(projectIDText)[1];
                            }
                        }
                        if (projectID != undefined) {
                            taskString += ', "project_id": "' + projectID + '"}';
                        } else {
                            taskString += '}';
                        }
                    }

                    var myHeaders = new Headers();
                    var bearer = 'Bearer ' + myToken;
                    myHeaders.append("Authorization", bearer);
                    myHeaders.append("Content-Type", "application/json");

                    var requestOptions = {
                        method: 'POST',
                        headers: myHeaders,
                        body: taskString
                    };
                    const response = await fetch(url, requestOptions);
                    const myTasks = await response.text();
                    var task = JSON.parse(myTasks);
                    var newTaskString1 = "";
                    newTaskString1 += "{{[[TODO]]}} ";
                    newTaskString1 += "" + task.content + "";
                    newTaskString1 += " [Link](" + task.url + ")";
                    if (newTaskUid != undefined) {
                        observer.disconnect();
                        await window.roamAlphaAPI.updateBlock({
                            block: {
                                uid: newTaskUid,
                                string: newTaskString1.toString()
                            }
                        });

                        await sleep(100);
                        observer.observe(targetNode1, obsConfig);
                        observer.observe(targetNode2, obsConfig);
                    } else {
                        await window.roamAlphaAPI.updateBlock({
                            block: {
                                uid: startBlock,
                                string: newTaskString1.toString()
                            }
                        });
                    }
                }
            }
        }

        async function linkTodoistProject() {
            var TodoistHeader, key;
            breakme: {
                if (!extensionAPI.settings.get("ttt-token")) {
                    key = "API";
                    sendConfigAlert(key);
                    break breakme;
                } else {
                    const myToken = extensionAPI.settings.get("ttt-token");
                    if (!extensionAPI.settings.get("ttt-import-header")) {
                        TodoistHeader = "Imported tasks";
                    } else {
                        TodoistHeader = extensionAPI.settings.get("ttt-import-header");
                    }
                    TodoistOverdue = extensionAPI.settings.get("ttt-overdue");
                    TodoistPriority = extensionAPI.settings.get("ttt-priority");
                    TodoistGetDescription = extensionAPI.settings.get("ttt-description");
                    TodoistCompleted = extensionAPI.settings.get("ttt-completed");
                    completedStrikethrough = extensionAPI.settings.get("ttt-completedStrikethrough");

                    var apiUrl = "https://api.todoist.com/rest/v2/projects";
                    var myHeaders = new Headers();
                    var bearer = 'Bearer ' + myToken;
                    myHeaders.append("Authorization", bearer);

                    var getOpts = {
                        method: 'GET',
                        headers: myHeaders,
                        redirect: 'follow'
                    }
                    const response = await fetch(apiUrl, getOpts);
                    var list = await response.json();

                    let selectString = "<select><option value=\"\">Select</option>";
                    for (var i = 0; i < list.length; i++) {
                        selectString += "<option value=\"" + list[i].id + "~" + list[i].name + "\">" + list[i].name + "</option>";
                    }
                    selectString += "</select>";
                    var pId = await prompt2(1, selectString, null);
                    if ((pId == "cancelled")) {
                        await prompt2(2, null, "You cancelled the project linking");
                        return null;
                    } else {
                        var projectText = "projectID: " + pId[0];
                        var startBlock = await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
                        if (!startBlock) {
                            var uri = window.location.href;
                            const regex = /^https:\/\/roamresearch.com\/#\/(app|offline)\/\w+$/; //today's DNP
                            if (uri.match(regex)) { // this is Daily Notes for today
                                var today = new Date();
                                var dd = String(today.getDate()).padStart(2, '0');
                                var mm = String(today.getMonth() + 1).padStart(2, '0');
                                var yyyy = today.getFullYear();
                                startBlock = mm + '-' + dd + '-' + yyyy;
                            }
                        }
                        let q = `[:find (pull ?page [:node/title :block/string :block/uid {:block/children ...} ]) :where [?page :block/uid "${startBlock}"]  ]`;
                        var info = await window.roamAlphaAPI.q(q);
                        if (info.length > 0) {
                            var projectLinked = false;
                            if (info[0][0].hasOwnProperty('children')) {
                                for (var i = 0; i < info[0][0]?.children.length; i++) {
                                    if (info[0][0].children[i].string.match("projectID: ")) { // there's already a project linked
                                        console.log("Updating project id");
                                        await window.roamAlphaAPI.updateBlock(
                                            { block: { uid: info[0][0].children[i].uid, string: projectText.toString(), open: true } });
                                        projectLinked = true;
                                    }
                                }
                            }
                            if (projectLinked == false) { // no project links, create one from clipboard
                                console.log("Creating project_id link");
                                var thisBlock = window.roamAlphaAPI.util.generateUID();
                                await window.roamAlphaAPI.createBlock({
                                    location: { "parent-uid": info[0][0].uid, order: 999 },
                                    block: { string: "", uid: thisBlock }
                                });
                                thisBlock = window.roamAlphaAPI.util.generateUID();
                                await window.roamAlphaAPI.createBlock({
                                    location: { "parent-uid": info[0][0].uid, order: 999 },
                                    block: { string: "---", uid: thisBlock }
                                });
                                thisBlock = window.roamAlphaAPI.util.generateUID();
                                await window.roamAlphaAPI.createBlock({
                                    location: { "parent-uid": info[0][0].uid, order: 10000 },
                                    block: { string: projectText.toString(), uid: thisBlock }
                                });
                            }
                        }

                        return importTasks(myToken, TodoistHeader, TodoistOverdue, TodoistPriority, TodoistGetDescription, pId[0], false, startBlock, false, null, null, TodoistCompleted, completedStrikethrough);
                    }
                }
            }
        }

        async function closeTask(taskIDClose, taskString, blockUID, taskUrl) {
            const myToken = extensionAPI.settings.get("ttt-token");
            completedStrikethrough = extensionAPI.settings.get("ttt-completedStrikethrough");
            var myHeaders = new Headers();
            var bearer = 'Bearer ' + myToken;
            myHeaders.append("Authorization", bearer);

            var requestOptions = {
                method: 'POST',
                headers: myHeaders,
                redirect: 'follow'
            };
            var url = "https://api.todoist.com/rest/v2/tasks/" + taskIDClose + "/close";
            const response = await fetch(url, requestOptions);
            if (!response.ok) {
                alert("Failed to complete task in Todoist");
            } else {
                var completedTaskString = "{{[[DONE]]}} ";
                if (completedStrikethrough) {
                    completedTaskString += "~~";
                }
                completedTaskString += taskString.trim() + " [Link](" + taskUrl + ")";
                if (completedStrikethrough) {
                    completedTaskString += "~~";
                };
                await window.roamAlphaAPI.updateBlock(
                    { block: { uid: blockUID, string: completedTaskString.toString(), open: false } });
                console.log("Task Completed in Todoist");
            }
            await sleep(50);
            initiateObserver();
        }

        async function reopenTask(taskIDReopen, taskString, blockUID, taskUrl) {
            const myToken = extensionAPI.settings.get("ttt-token");
            var myHeaders = new Headers();
            var bearer = 'Bearer ' + myToken;
            myHeaders.append("Authorization", bearer);

            var getOpts = {
                method: 'GET',
                headers: myHeaders,
                redirect: 'follow'
            }
            var gUrl = "https://api.todoist.com/rest/v2/tasks/" + taskIDReopen + "/";
            const gResponse = await fetch(gUrl, getOpts);
            var gTask = await gResponse.text();
            var gTaskJSON = JSON.parse(gTask);
            if (gTaskJSON.due.is_recurring == true) {
                alert("You can't un-complete a recurring task!");
                /*
                console.info("recurring task");
                var uuid;
                if (/electron/i.test(navigator.userAgent)) {
                    function uuidv4() {
                        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
                          (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
                        );
                      }
                      
                      uuid = uuidv4();
                } else {
                    uuid = self.crypto.randomUUID();
                }
                var dueDateTime = new Date(gTaskJSON.due.datetime);
                var hr = String(dueDateTime.getHours()).padStart(2, '0');
                var min = String(dueDateTime.getMinutes()).padStart(2, '0');
                let newDateTime = new Date();
                newDateTime.setHours(hr, min, 0, 0);
                
                var url = "https://api.todoist.com/sync/v9/sync/";
                var opts = {
                    method: 'POST',
                    headers: myHeaders,
                    body: '{}',
                    redirect: 'follow'
                } */
                var reopenedTaskString = "{{[[DONE]]}} ~~" + taskString.trim() + " [Link](" + taskUrl + ")~~";
                await window.roamAlphaAPI.updateBlock(
                    { block: { uid: blockUID, string: reopenedTaskString.toString(), open: true } });
                await sleep(50);
                initiateObserver();
            } else {
                var requestOptions = {
                    method: 'POST',
                    headers: myHeaders,
                    redirect: 'follow'
                };
                var url = "https://api.todoist.com/rest/v2/tasks/" + taskIDReopen + "/reopen";
                const response = await fetch(url, requestOptions);
                if (!response.ok) {
                    alert("Failed to reopen task in Todoist");
                } else {
                    var reopenedTaskString = "{{[[TODO]]}} " + taskString.trim();
                    /*
                if (RRTag) {
                    reopenedTaskString += " #[["+RRTag+"]]";
                } */
                    reopenedTaskString += " [Link](" + taskUrl + ")";
                    await window.roamAlphaAPI.updateBlock(
                        { block: { uid: blockUID, string: reopenedTaskString.toString(), open: true } });
                    console.log("Task reopened in Todoist");
                }
                await sleep(50);
                initiateObserver();
            }
        }

        async function importTasks(
            myToken,
            TodoistHeader,
            TodoistOverdue,
            TodoistPriority,
            TodoistGetDescription,
            projectID,
            DNP,
            currentPageUID,
            auto,
            autoBlockUid,
            SB,
            TodoistCompleted,
            completedStrikethrough,
        ) {
            if (isImportRunning) {
                return;
            }
            isImportRunning = true;

            try {
                const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
                let datedDNP = false;
                let todoistDate = null;
                let url, urlC;

                if (dateRegex.test(currentPageUID)) {
                    const [dd, mm, yyyy] = currentPageUID.split("-");
                    todoistDate = `${yyyy}-${mm}-${dd}`;
                    datedDNP = true;
                }

                if (DNP || auto) {
                    url = TodoistOverdue
                        ? "https://api.todoist.com/rest/v2/tasks?filter=Today|Overdue"
                        : "https://api.todoist.com/rest/v2/tasks?filter=Today";
                } else if (projectID) {
                    url = Array.isArray(projectID)
                        ? `https://api.todoist.com/rest/v2/tasks?project_id=${projectID[1]}`
                        : `https://api.todoist.com/rest/v2/tasks?project_id=${projectID}`;
                } else if (datedDNP) {
                    const today = new Date();
                    const todayStr = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}-${today.getFullYear()}`;
                    if (currentPageUID !== todayStr) {
                        url = `https://api.todoist.com/rest/v2/tasks?filter=${todoistDate}`;
                    } else {
                        url = TodoistOverdue
                            ? "https://api.todoist.com/rest/v2/tasks?filter=Today|Overdue"
                            : "https://api.todoist.com/rest/v2/tasks?filter=Today";
                    }
                }
                
                let previousTasks = [];
                if (extensionAPI.settings.get("ttt:tasks")) {
                    previousTasks = JSON.parse(extensionAPI.settings.get("ttt:tasks"));
                    extensionAPI.settings.set("ttt:tasks-lastsync", extensionAPI.settings.get("ttt:tasks"));
                    extensionAPI.settings.set("ttt:tasks-lastsync:time", Date.now());
                }
                let previousComments = [];
                if (extensionAPI.settings.get("ttt:comments")) {
                    previousComments = JSON.parse(extensionAPI.settings.get("ttt:comments"));
                    extensionAPI.settings.set("ttt:comments-lastsync", extensionAPI.settings.get("ttt:comments"));
                }

                const prevById = new Map();
                if (Array.isArray(previousTasks)) {
                    for (const t of previousTasks) {
                        prevById.set(String(t.id), { parent_id: t.parent_id || null, content: t.content || "" });
                    }
                }
                
                const existingQuery = await window.roamAlphaAPI.q(
                    `[:find (pull ?p [:node/title :block/string :block/uid {:block/children ...}]) :where [?p :block/uid "${autoBlockUid}"]]`
                );
                const headerNode = existingQuery?.[0]?.[0] || null;
                
                const TASK_URL_ANY_ID = /todoist\.com\/(?:app\/task\/|showTask\?id=)([A-Za-z0-9_-]{6,}|\d{9,20})/;
                const COMMENT_ID_RE = /#comment-([0-9]{9,10})/;

                const existingTaskMap = new Map();
                const parentUidByTaskId = new Map();
                const existingCommentIds = new Set();
                const existingHeuristicKeys = new Set();

                function normalizeForKey(s) {
                    if (!s) return "";
                    let x = s.replace(/{{\[\[(TODO|DONE)\]\]}}\s*/g, "")
                        .replace(/~~/g, "")
                        .replace(/\s#Priority-\d\b/g, "")
                        .replace(/\s\[Link]\([^)]+\)/g, "")
                        .trim()
                        .toLowerCase();
                    return x;
                }
                function lineState(s) {
                    return s.includes("{{[[DONE]]}}") ? "done"
                        : s.includes("{{[[TODO]]}}") ? "todo"
                            : "other";
                }

                function walk(block) {
                    if (!block) return;
                    const s = block.string || "";
                    const state = lineState(s);
                    const isTaskLine = state === "todo" || state === "done";
                    
                    if (isTaskLine) {
                        const key = `${normalizeForKey(s)}|${state}`;
                        if (key.length > 1) existingHeuristicKeys.add(key);
                    }
                    
                    const m = s.match(TASK_URL_ANY_ID);
                    const id = m ? m[1] : null;
                    
                    if (id && isTaskLine) {
                        existingTaskMap.set(id, { uid: block.uid, done: state === "done" });
                        if (!parentUidByTaskId.has(id)) parentUidByTaskId.set(id, block.uid);
                    }
                    
                    const cm = s.match(COMMENT_ID_RE);
                    if (cm) existingCommentIds.add(cm[1]);

                    if (Array.isArray(block.children)) block.children.forEach(walk);
                }
                if (headerNode?.children) headerNode.children.forEach(walk);
                
                const myHeaders = new Headers();
                myHeaders.append("Authorization", "Bearer " + myToken);
                myHeaders.append("Content-Type", "application/json");
                const requestOptions = { method: "GET", headers: myHeaders, redirect: "follow" };
                
                const resp = await fetch(url, requestOptions);
                const activeTasks = await resp.json();

                extensionAPI.settings.set("ttt:tasks", JSON.stringify(activeTasks));
                extensionAPI.settings.set("ttt:tasks:time", Date.now());
                
                const activeParents = [];
                const activeSubtasksByParent = new Map();
                for (const t of activeTasks || []) {
                    if (t?.parent_id) {
                        const pid = String(t.parent_id);
                        if (!activeSubtasksByParent.has(pid)) activeSubtasksByParent.set(pid, []);
                        activeSubtasksByParent.get(pid).push(t);
                    } else {
                        activeParents.push(t);
                    }
                }
                
                let completedItems = [];
                if (TodoistCompleted && (DNP || datedDNP || projectID)) {
                    function startOfDayLocal(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
                    function fmtLocalMidnight(d) {
                        const yyyy = d.getFullYear();
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        const dd = String(d.getDate()).padStart(2, '0');
                        return `${yyyy}-${mm}-${dd}T00:00:00`;
                    }
                    const todayStart = startOfDayLocal();
                    const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
                    const sinceLocal = fmtLocalMidnight(todayStart);
                    const untilLocal = fmtLocalMidnight(tomorrowStart);

                    urlC = `https://api.todoist.com/api/v1/tasks/completed/by_completion_date?since=${encodeURIComponent(sinceLocal)}&until=${encodeURIComponent(untilLocal)}`;

                    const cResp = await fetch(urlC, requestOptions);
                    const completedJSON = await cResp.json();
                    completedItems = completedJSON?.items || [];
                    extensionAPI.settings.set("ttt:tasksCompleted", JSON.stringify(completedJSON));
                    extensionAPI.settings.set("ttt:tasksCompleted:time", Date.now());
                }
                
                const isDoneLineNode = (n) => (n?.text || "").includes("{{[[DONE]]}}");
                const isTaskChildNode = (n) => {
                    const s = (n?.text || "");
                    return s.includes("{{[[TODO]]}}") || s.includes("{{[[DONE]]}}");
                };
                const canonicalLinkForId = (id) => `https://app.todoist.com/app/task/${id}`;

                function priorityNumber(p) {
                    if (p == "4") return "1";
                    if (p == "3") return "2";
                    if (p == "2") return "3";
                    return "4";
                }
                function buildTodoLine(task) {
                    const id = String(task.id);
                    const link = canonicalLinkForId(id);
                    let str = "{{[[TODO]]}} " + task.content;
                    if (TodoistPriority && task.priority) str += " #Priority-" + priorityNumber(task.priority);
                    str += ` [Link](${link})`;
                    return { text: str, id };
                }
                function buildDoneLineFromCompleted(it) {
                    const id = String(it.id);
                    const link = canonicalLinkForId(id);
                    let txt = "{{[[DONE]]}} ";
                    if (completedStrikethrough) txt += "~~";
                    txt += `${it.content} [Link](${link})`;
                    if (completedStrikethrough) txt += "~~";
                    return { text: txt, id };
                }
                async function fetchComments(taskId) {
                    const url = `https://api.todoist.com/rest/v2/comments?task_id=${taskId}`;
                    const r = await fetch(url, requestOptions);
                    if (!r.ok) return [];
                    const json = await r.json();
                    return json;
                }
                async function buildExtras(task) {
                    const extras = [];
                    if (TodoistGetDescription && task.description) {
                        extras.push({ text: task.description.toString() });
                    }
                    if (TodoistGetComments && task.comment_count > 0) {
                        const comms = await fetchComments(task.id);
                        for (const c of comms) {
                            if (existingCommentIds.has(String(c.id))) continue;
                            let commentString = c.content || "";
                            if (c.attachment) {
                                if (c.attachment.file_type === "application/pdf") commentString = `{{pdf: ${c.attachment.file_url}}}`;
                                else if (c.attachment.file_type === "image/jpeg" || c.attachment.file_type === "image/png") commentString = `![](${c.attachment.file_url})`;
                                else if (c.attachment.file_type === "text/html") commentString = `${c.content} [Email Body](${c.attachment.file_url})`;
                            }
                            commentString += ` [Link](https://todoist.com/showTask?id=${c.task_id}#comment-${c.id})`;
                            extras.push({ text: commentString, tID: c.task_id, ID: c.id });
                        }
                    }
                    return extras;
                }
                async function insertChildBlock({ parentUid, order, node }) {
                    return createBlock({ parentUid, order, node });
                }
                function orderParentChildren(node) {
                    if (!node?.children || !Array.isArray(node.children) || node.children.length === 0) return node;
                    const nonTasks = [];
                    const taskChildren = [];
                    for (const ch of node.children) (isTaskChildNode(ch) ? taskChildren : nonTasks).push(ch);
                    const taskTodos = taskChildren.filter(ch => !isDoneLineNode(ch));
                    const taskDones = taskChildren.filter(ch => isDoneLineNode(ch));
                    node.children = [...nonTasks, ...taskTodos, ...taskDones];
                    return node;
                }
                
                const headerChildrenToAdd = [];
                let childInserts = [];
                
                for (const t of activeParents) {
                    const id = String(t.id);
                    const todoKey = `${normalizeForKey(`{{[[TODO]]}} ${t.content}`)}|todo`;
                    if (existingTaskMap.has(id) || existingHeuristicKeys.has(todoKey)) {
                        continue;
                    }

                    const { text: parentText } = buildTodoLine(t);
                    const node = { text: parentText };
                    const children = await buildExtras(t);

                    if (TodoistGetSubtasks && activeSubtasksByParent.has(id)) {
                        for (const st of activeSubtasksByParent.get(id)) {
                            const stId = String(st.id);
                            const stKey = `${normalizeForKey(`{{[[TODO]]}} ${st.content}`)}|todo`;
                            if (existingTaskMap.has(stId) || existingHeuristicKeys.has(stKey)) {
                                continue;
                            }
                            const { text: subText } = buildTodoLine(st);
                            const subNode = { text: subText };
                            const subExtras = await buildExtras(st);
                            if (subExtras.length) subNode.children = subExtras;
                            children.push(subNode);
                        }
                    }

                    if (children.length) node.children = children;
                    headerChildrenToAdd.push(orderParentChildren(node));
                }
                
                if (TodoistGetSubtasks) {
                    const pendingChildByParent = new Map();
                    for (const [parentId, subs] of activeSubtasksByParent.entries()) {
                        if (!parentUidByTaskId.has(parentId)) continue;
                        const parentUid = parentUidByTaskId.get(parentId);
                        const newSubs = subs.filter(st => {
                            const stId = String(st.id);
                            const stKey = `${normalizeForKey(`{{[[TODO]]}} ${st.content}`)}|todo`;
                            return !(existingTaskMap.has(stId) || existingHeuristicKeys.has(stKey));
                        });
                        if (!newSubs.length) continue;
                        if (!pendingChildByParent.has(parentUid)) pendingChildByParent.set(parentUid, []);
                        for (const st of newSubs) {
                            const { text: subText } = buildTodoLine(st);
                            const subNode = { text: subText };
                            const subExtras = await buildExtras(st);
                            if (subExtras.length) subNode.children = subExtras;
                            pendingChildByParent.get(parentUid).push({ parentUid, order: 999, node: subNode });
                        }
                    }
                    
                    for (const [puid, arr] of pendingChildByParent.entries()) {
                        arr.sort((a, b) => {
                            const aDone = isDoneLineNode(a.node);
                            const bDone = isDoneLineNode(b.node);
                            return (aDone === bDone) ? 0 : (aDone ? 1 : -1);
                        });
                        childInserts = childInserts.concat(arr);
                    }
                }
                
                if (TodoistCompleted && completedItems.length) {
                    const pendingChildByParent = new Map();
                    const doneHeaderAdds = [];

                    for (const it of completedItems) {
                        const { text: doneText, id } = buildDoneLineFromCompleted(it);
                        const heuristicKey = `${normalizeForKey(doneText)}|done`;

                        if (existingTaskMap.has(id) || existingHeuristicKeys.has(heuristicKey)) {
                            continue;
                        }

                        const parentId = prevById.get(id)?.parent_id != null ? String(prevById.get(id).parent_id) : null;

                        if (parentId && parentUidByTaskId.has(parentId)) {
                            const parentUid = parentUidByTaskId.get(parentId);
                            if (!pendingChildByParent.has(parentUid)) pendingChildByParent.set(parentUid, []);
                            pendingChildByParent.get(parentUid).push({ parentUid, order: 999, node: { text: doneText } });
                        } else {
                            const maybeParent = headerChildrenToAdd.find(n =>
                                (n.text || "").includes(`/app/task/${parentId}`) || (n.text || "").includes(`showTask?id=${parentId}`)
                            );
                            if (parentId && maybeParent) {
                                if (!maybeParent.children) maybeParent.children = [];
                                maybeParent.children.push({ text: doneText });
                                orderParentChildren(maybeParent);
                            } else {
                                doneHeaderAdds.push({ text: doneText });
                            }
                        }
                    }
                    
                    for (const [puid, arr] of pendingChildByParent.entries()) {
                        arr.sort((a, b) => {
                            const aDone = isDoneLineNode(a.node);
                            const bDone = isDoneLineNode(b.node);
                            return (aDone === bDone) ? 0 : (aDone ? 1 : -1);
                        });
                        childInserts = childInserts.concat(arr);
                    }
                    
                    for (const dn of doneHeaderAdds) headerChildrenToAdd.push(dn);
                }
                
                const headerTodos = headerChildrenToAdd.filter(n => !isDoneLineNode(n));
                const headerDones = headerChildrenToAdd.filter(n => isDoneLineNode(n));
                const orderedHeaderChildren = [...headerTodos, ...headerDones];
                
                if (extensionAPI.settings.get("ttt:comments")) {
                    extensionAPI.settings.set("ttt:comments-lastsync", extensionAPI.settings.get("ttt:comments"));
                }
                extensionAPI.settings.set("ttt:comments:time", Date.now());
                
                if (SB) {
                    return [{ text: TodoistHeader.toString(), children: orderedHeaderChildren }];
                }
                if (!auto) {
                    return orderedHeaderChildren;
                }
                
                const newTodos = orderedHeaderChildren.filter(n => !isDoneLineNode(n));
                const newDones = orderedHeaderChildren.filter(n => isDoneLineNode(n));

                for (let i = newTodos.length - 1; i >= 0; i--) {
                    const n = newTodos[i];
                    await createBlock({ parentUid: autoBlockUid, order: 0, node: n });
                }
                
                for (let i = 0; i < newDones.length; i++) {
                    const n = newDones[i];
                    await createBlock({ parentUid: autoBlockUid, order: 999999, node: n });
                }
                
                for (let i = 0; i < childInserts.length; i++) {
                    const ins = childInserts[i];
                    await insertChildBlock(ins);
                }
                
                try {
                    const headerQuery = await window.roamAlphaAPI.q(
                        `[:find (pull ?p [:block/uid {:block/children [:block/uid :block/string :block/order]}])
      :where [?p :block/uid "${autoBlockUid}"]]`
                    );
                    const headerNode2 = headerQuery?.[0]?.[0];
                    if (headerNode2?.children?.length) {
                        const children = headerNode2.children.map(c => ({
                            uid: c.uid,
                            text: c.string || ""
                        }));

                        const todos = children.filter(c => c.text.includes("{{[[TODO]]}}"));
                        const dones = children.filter(c => c.text.includes("{{[[DONE]]}}"));
                        
                        if (todos.length > 0 && dones.length > 0) {
                            const reordered = [...todos, ...dones];
                            const currentOrder = children.map(c => c.uid).join("|");
                            const desiredOrder = reordered.map(c => c.uid).join("|");
                            if (currentOrder !== desiredOrder) {
                                for (let i = 0; i < reordered.length; i++) {
                                    await window.roamAlphaAPI.moveBlock({
                                        location: { 'parent-uid': autoBlockUid, order: i },
                                        block: { uid: reordered[i].uid }
                                    });
                                }
                            } else {
                                // console.info("[Reorder] Skipped: already in desired order.");
                            }
                        } else {
                            // console.info("[Reorder] Skipped: not enough variety (need both TODO and DONE).");
                        }
                    }
                } catch (err) {
                    console.error("[Reorder] Failed (moveBlock):", err);
                }
                
            } catch (err) {
                console.error("importTasks ERROR:", err);
            } finally {
                isImportRunning = false;
            }
        }

    },
    onunload: () => {
        window.roamAlphaAPI.ui.blockContextMenu.removeCommand({
            label: "Reschedule task(s) in Todoist"
        });
        if (window.roamjs?.extension?.smartblocks) {
            window.roamjs.extension.smartblocks.unregisterCommand("IMPORTTODOIST");
        };

        observer.disconnect();
        window.removeEventListener('keydown', keyEventHandler, false);
        clearInterval(checkTDInterval);
    }
}

// helper functions
function sendConfigAlert(key) {
    if (key == "API") {
        alert("Please set your API token in the configuration settings via the Roam Depot tab.");
    }
}

function convertToRoamDate(dateString) {
    var parsedDate = dateString.split('-');
    var year = parsedDate[2];
    var month = Number(parsedDate[0]);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var monthName = months[month - 1];
    var day = Number(parsedDate[1]);
    let suffix = (day >= 4 && day <= 20) || (day >= 24 && day <= 30)
        ? "th"
        : ["st", "nd", "rd"][day % 10 - 1];
    return "" + monthName + " " + day + suffix + ", " + year + "";
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function prompt2(index, selectString, string) {
    if (index == 1) {
        return new Promise((resolve) => {
            var pId, pName;
            iziToast.question({
                theme: 'light',
                color: 'black',
                layout: 2,
                class: 'toTaMa',
                drag: false,
                timeout: false,
                close: true,
                overlay: true,
                title: "Todoist Task Management",
                message: "Select which project to link",
                position: 'center',
                onClosed: function () { resolve("cancelled") },
                closeOnEscape: true,
                inputs: [
                    ['<label>Project *' + selectString + '</label>', 'change', function (instance, toast, select, e) {
                        pId = e.target.value.split("~")[0];
                        pName = e.target.value.split("~")[1];
                    }],
                ],
                buttons: [
                    ['<button><b>Confirm</b></button>', function (instance, toast, button, e, inputs) {
                        instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
                        resolve([pId, pName]);
                    }, false], // true to focus
                    [
                        "<button>Cancel</button>",
                        function (instance, toast, button, e) {
                            instance.hide({ transitionOut: "fadeOut" }, toast, "button");
                            resolve("cancelled");
                        },
                    ],
                ]
            });
        })
    } else if (index == 2) { // alert
        iziToast.show({
            theme: 'dark',
            message: string,
            class: 'toTaMa-info',
            position: 'center',
            close: false,
            timeout: 3000,
            closeOnClick: true,
            closeOnEscape: true,
            displayMode: 2
        });
    }
}