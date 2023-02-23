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
        /* // this is here only because I sometimes need to see what I've stored in the settings with each sync
        window.tdExtAPI = {
            get: extensionAPI.settings.get,
        }
        */
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
            label: "Link to Todoist project via clipboard",
            callback: () => linkTodoistProject(),
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
                        if (mutation.addedNodes[0]?.innerHTML?.includes("https://todoist.com/showTask?id=")) {
                            observer.disconnect();
                            var taskString = mutation.addedNodes[0]?.innerText?.slice(0, mutation.addedNodes[0]?.innerText?.length - 4);
                            var taskUrl = mutation.addedNodes[0]?.innerHTML.split("href=\"");
                            var taskUrl2 = taskUrl[1].split("\"");
                            taskUrl = taskUrl2[0];
                            var taskData = mutation.addedNodes[0]?.innerHTML?.split("Task?id=");
                            var regex = /^(\d{9,10})/gm;
                            var taskIDClose = taskData[1].match(regex);
                            var rrUID = mutation.target?.id?.slice(-9);
                            closeTask(taskIDClose, taskString, rrUID, taskUrl);
                        }
                    } else if (mutation.addedNodes[0]?.childNodes[0]?.childNodes[0]?.control?.checked == false) {
                        if (mutation.addedNodes[0]?.innerHTML?.includes("https://todoist.com/showTask?id=")) {
                            observer.disconnect();
                            var taskString = mutation.addedNodes[0]?.innerText?.slice(0, mutation.addedNodes[0]?.innerText?.length - 4);
                            var taskUrl = mutation.addedNodes[0]?.innerHTML.split("href=\"");
                            var taskUrl2 = taskUrl[1].split("\"");
                            taskUrl = taskUrl2[0];
                            var taskData = mutation.addedNodes[0]?.innerHTML?.split("Task?id=");
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
                    const TodoistOverdue = extensionAPI.settings.get("ttt-overdue");
                    const TodoistPriority = extensionAPI.settings.get("ttt-priority");
                    const TodoistGetDescription = extensionAPI.settings.get("ttt-description");

                    const clipText = await navigator.clipboard.readText();
                    const regex = /^\d{10}$/;
                    if (!regex.test(clipText)) {
                        alert('Please make sure that the clipboard contains the (10 digit number) Todoist Project ID');
                    } else {
                        var projectText = "projectID: " + clipText;
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
                    }
                    importTasks(myToken, TodoistHeader, TodoistOverdue, TodoistPriority, TodoistGetDescription, clipText, false, false);
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
                    var reopenedTaskString = "{{[[DONE]]}} " + taskString.trim();
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

        async function importTasks(myToken, TodoistHeader, TodoistOverdue, TodoistPriority, TodoistGetDescription, projectID, DNP, currentPageUID, auto, autoBlockUid, SB, TodoistCompleted, completedStrikethrough) {
            const regex = /^\d{2}-\d{2}-\d{4}$/;
            var datedDNP = false;
            var url, urlC;

            if (regex.test(currentPageUID)) {
                var dateString = currentPageUID.split("-");
                var todoistDate = dateString[2] + "-" + dateString[0] + "-" + dateString[1];
                datedDNP = true;
            }
            
            if (DNP || auto) {
                if (TodoistOverdue == true) {
                    url = "https://api.todoist.com/rest/v2/tasks?filter=Today|Overdue";
                } else {
                    url = "https://api.todoist.com/rest/v2/tasks?filter=Today";
                }
            } else if (projectID) { // a project page
                if (Array.isArray(projectID)) {
                    url = "https://api.todoist.com/rest/v2/tasks?project_id=" + projectID[1].toString();
                } else {
                    url = "https://api.todoist.com/rest/v2/tasks?project_id=" + projectID.toString();
                }
            } else if (datedDNP) { // dated DNP
                var today = new Date();
                var dd = String(today.getDate()).padStart(2, '0');
                var mm = String(today.getMonth() + 1).padStart(2, '0');
                var yyyy = today.getFullYear();
                today = mm + '-' + dd + '-' + yyyy;
                if (currentPageUID != today) {
                    url = "https://api.todoist.com/rest/v2/tasks?filter=" + todoistDate;
                } else {
                    if (TodoistOverdue == true) {
                        url = "https://api.todoist.com/rest/v2/tasks?filter=Today|Overdue";
                    } else {
                        url = "https://api.todoist.com/rest/v2/tasks?filter=Today";
                    }
                }
            }

            var previousTasks, previousComments;
            if (extensionAPI.settings.get("ttt:tasks")) {
                previousTasks = JSON.parse(extensionAPI.settings.get("ttt:tasks"));
                extensionAPI.settings.set("ttt:tasks-lastsync", extensionAPI.settings.get("ttt:tasks"));
                extensionAPI.settings.set("ttt:tasks-lastsync:time", Date.now());
            }
            if (extensionAPI.settings.get("ttt:comments")) {
                previousComments = JSON.parse(extensionAPI.settings.get("ttt:comments"));
                extensionAPI.settings.set("ttt:comments-lastsync", extensionAPI.settings.get("ttt:comments"));
            }
            existingItems = await window.roamAlphaAPI.q(`[:find (pull ?page [:node/title :block/string :block/uid :block/order :edit/time {:block/children ...} ]) :where [?page :block/uid "${autoBlockUid}"] ]`);

            var myHeaders = new Headers();
            var bearer = 'Bearer ' + myToken;
            myHeaders.append("Authorization", bearer);
            myHeaders.append("Content-Type", "application/json");

            if (advancedChildManagement) { // user can decide whether to turn on these features or not, in Roam Depot settings
                var taskDate = new Date(extensionAPI.settings.get("ttt:tasks:time")).getDate();
                var taskLastDate = new Date(extensionAPI.settings.get("ttt:tasks-lastsync:time")).getDate();

                if (taskDate == taskLastDate) { // check that we're comparing the current tree to tasks fetched on the same day
                    // we need to process the existing tree under the Todoist header for new tasks, sub-tasks and comments
                    if (existingItems != null && existingItems != undefined && existingItems?.[0]?.[0]?.hasOwnProperty("children")) { // make sure there are tasks under the header
                        for (var o = 0; o < existingItems[0][0].children.length; o++) { // this is the first child level, only tasks but no comments or subtasks
                            const regex = /showTask\?id=([0-9]{9,10})/;
                            let taskID;
                            if (regex.test(existingItems[0][0].children[o].string)) {
                                taskID = existingItems[0][0].children[o].string.match(regex)[1];
                            }
                            if (taskID == undefined || taskID == null) { // there wasn't a task link, so must be a new task
                                await createTodoistTask(existingItems[0][0].children[o].string.toString(), existingItems[0][0].children[o].uid, null, existingItems[0][0].children[o].uid);
                            } else { // this is already a task, so check if we've changed the name
                                let checkString = existingItems[0][0].children[o].string.trim();
                                let checkString1 = checkString.split("[Link]");
                                let checkString2 = checkString1[0].split("{{[[TODO]]}}");
                                let finalString = checkString2[1];
                                if (checkString2[1] && checkString2[1].match("#Priority")) {
                                    finalString = checkString2[1].split("#Priority")[0].trim();
                                }
                                for (var p = 0; p < previousTasks.length; p++) {
                                    if (taskID == previousTasks[p].id) { // found a matching task id from previous sync
                                        if (finalString != previousTasks[p].content) { // we must have changed the task name, so update it 
                                            var url3 = "https://api.todoist.com/rest/v2/tasks/" + previousTasks[p].id + "";
                                            let taskContent = JSON.stringify({
                                                "content": finalString
                                            });
                                            var requestOptions3 = {
                                                method: 'POST',
                                                headers: myHeaders,
                                                redirect: 'follow',
                                                body: taskContent
                                            };
                                            const response3 = await fetch(url3, requestOptions3);
                                            if (!response3.ok) {
                                                alert("Failed to update task in Todoist");
                                            }
                                        }
                                    }
                                }
                            }

                            // now, check if it has children (subtasks, comments or description)
                            if (existingItems[0][0].children[o].hasOwnProperty("children")) { // there are children to this task
                                for (var t = 0; t < existingItems[0][0].children[o].children.length; t++) {
                                    const regexTaskID = /showTask\?id=([0-9]{9,10})/;
                                    const regexTaskString = /{{\[\[TODO\]\]}} (.+) \[Link\]\(.+showTask\?id=[0-9]{9,10}\)/;
                                    const regexCommentID = /comment-([0-9]{9,10})/;
                                    const regexCommentString = /(.+) \[Link\]\(.+\#comment-[0-9]{9,10}\)/;
                                    let childID, commentID, childString, finalchildString, finalchildString1;
                                    if (regexCommentID.test(existingItems[0][0].children[o].children[t].string)) { // this block has a commentID
                                        commentID = existingItems[0][0].children[o].children[t].string.match(regexCommentID)[1].toString();
                                    } else if (regexTaskID.test(existingItems[0][0].children[o].children[t].string)) { // this block has a taskID
                                        childID = existingItems[0][0].children[o].children[t].string.match(regexTaskID)[1];
                                    }

                                    if (regexCommentString.test(existingItems[0][0].children[o].children[t].string)) { // this block is a comment, get string
                                        finalchildString = existingItems[0][0].children[o].children[t].string.match(regexCommentString)[1];
                                    } else if (regexTaskString.test(existingItems[0][0].children[o].children[t].string)) {
                                        childString= existingItems[0][0].children[o].children[t].string.match(regexTaskString)[1];
                                        if (childString.match("#Priority")) {
                                            let finalchildString2 = childString.split("#Priority");
                                            finalchildString = finalchildString2[0];
                                        }
                                    } else {
                                        finalchildString = existingItems[0][0].children[o].children[t].string;
                                    }
                                    if (finalchildString != undefined && finalchildString != null) {
                                        finalchildString1 = finalchildString.trim();
                                    }
                                    
                                    if (childID == undefined && commentID == undefined) { // this is not a known sub-task or comment
                                        let todTaskId = existingItems[0][0].children[o].string; // get parent Todoist task id
                                        var parentID;
                                        if (todTaskId.includes("Task?id=")) { // get the parent task id from the tree
                                            var taskData = todTaskId.split("Task?id=");
                                            var regex1 = /^(\d{9,10})/gm;
                                            if (taskData[1]) {
                                                let parentID1 = taskData[1].match(regex1);
                                                parentID = parentID1[0];
                                            }
                                        } else { // we must have just created the parent task, so existingItems doesn't have the ID yet
                                            let parentString = await window.roamAlphaAPI.q(
                                                `[:find ?u :where [?p :block/string ?u] [?p :block/children ?e] [?e :block/uid "${existingItems[0][0].children[o].children[t].uid}"]]`
                                            )?.[0]?.[0].toString();
                                            const regexTaskID = /showTask\?id=([0-9]{9,10})/;
                                            if (regexTaskID.test(parentString)) {
                                                parentID = parentString.match(regexTaskID)[1];
                                            }
                                        }

                                        if (!finalchildString1.startsWith("{{pdf:") && !finalchildString1.includes("[Email Body]") && !finalchildString1.startsWith("![](")) {
                                            if (finalchildString1.includes("{{[[TODO]]}}")) { // must be a new sub-task
                                                await createTodoistTask(finalchildString1, existingItems[0][0].children[o].children[t].uid, parentID, existingItems[0][0].children[o].uid);
                                            } else if (previousTasks != undefined && previousTasks != null) { // not a sub-task so check if description
                                                var descMatch = false;
                                                for (var n = 0; n < previousTasks.length; n++) {
                                                    if (finalchildString1 == previousTasks[n].description) {
                                                        descMatch = true;
                                                    }
                                                }
                                                if (descMatch == false) { // doesn't match the description, must be a new comment                                      
                                                    var url2 = "https://api.todoist.com/rest/v2/comments";
                                                    let taskContent2 = JSON.stringify({
                                                        "task_id": parentID,
                                                        "content": finalchildString1
                                                    });
                                                    var requestOptions2 = {
                                                        method: 'POST',
                                                        headers: myHeaders,
                                                        redirect: 'follow',
                                                        body: taskContent2
                                                    };

                                                    const response2 = await fetch(url2, requestOptions2);
                                                    if (!response2.ok) {
                                                        alert("Failed to add comment to task in Todoist");
                                                    }
                                                }
                                            }
                                        }
                                    } else if (childID != undefined) { // this is a known sub-task
                                        for (var p = 0; p < previousTasks.length; p++) {
                                            if (childID == previousTasks[p].id) {
                                                if (finalchildString1 != previousTasks[p].content) { // we must have changed the task name 
                                                    var url4 = "https://api.todoist.com/rest/v2/tasks/" + previousTasks[p].id + "";
                                                    let taskContent = JSON.stringify({
                                                        "content": finalchildString1
                                                    });
                                                    var requestOptions4 = {
                                                        method: 'POST',
                                                        headers: myHeaders,
                                                        redirect: 'follow',
                                                        body: taskContent
                                                    };
                                                    const response4 = await fetch(url4, requestOptions4);
                                                    if (!response4.ok) {
                                                        alert("Failed to update task in Todoist");
                                                    }
                                                }
                                            }
                                        }
                                    } else if (commentID != undefined) { // check for comment renaming here
                                        for (var u = 0; u < previousComments.length; u++) {
                                            if (previousComments[u].commentsJSON.length > 0) {
                                                for (var v = 0; v < previousComments[u].commentsJSON.length; v++) {
                                                    if (commentID == previousComments[u].commentsJSON[v].id) {
                                                        if (finalchildString1 != previousComments[u].commentsJSON[v].content) { // we must have changed the comment text
                                                            var url5 = "https://api.todoist.com/rest/v2/comments/" + commentID + "";
                                                            let taskContent = JSON.stringify({
                                                                "content": finalchildString1
                                                            });
                                                            var requestOptions5 = {
                                                                method: 'POST',
                                                                headers: myHeaders,
                                                                redirect: 'follow',
                                                                body: taskContent
                                                            };
                                                            const response5 = await fetch(url5, requestOptions5);
                                                            if (!response5.ok) {
                                                                alert("Failed to update comment in Todoist");
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // delete all childblocks to allow creation of new task list
            if (existingItems?.[0]?.[0].hasOwnProperty("children")) {
                for (var i = 0; i < existingItems[0][0].children.length; i++) {
                    await window.roamAlphaAPI.deleteBlock({ "block": { "uid": existingItems[0][0].children[i].uid } });
                }
            }

            // now, get up-to-date task list from Todoist
            var requestOptions = {
                method: 'GET',
                headers: myHeaders,
                redirect: 'follow'
            };
            const response = await fetch(url, requestOptions);
            const myTasks = await response.text();
            var task;

            let taskList = [];
            let subTaskList = [];
            let output = [];
            let comments = [];
            let cTasks = [];
            extensionAPI.settings.set("ttt:tasks", JSON.stringify(JSON.parse(myTasks)));
            extensionAPI.settings.set("ttt:tasks:time", Date.now());

            for await (task of JSON.parse(myTasks)) {
                if (task.hasOwnProperty("parent_id") && task.parent_id != null) {
                    subTaskList.push({ id: task.id, parent_id: task.parent_id, order: task.order, content: task.content, url: task.url, priority: task.priority });
                } else {
                    taskList.push({ id: task.id, uid: "temp" });
                }
            }
            
            if (TodoistCompleted && (DNP || datedDNP)) {
                const date = new Date();
                date.setHours(0, 0, 0, 0);
                let sinceDate = new Date(date.setMinutes(date.getMinutes() + date.getTimezoneOffset()));
                let year = sinceDate.getFullYear();
                var dd = String(sinceDate.getDate()).padStart(2, '0');
                var mm = String(sinceDate.getMonth() + 1).padStart(2, '0');
                var hr = String(sinceDate.getHours()).padStart(2, '0');
                var min = String(sinceDate.getMinutes()).padStart(2, '0');
                const sinceString = "" + year + "-" + mm + "-" + dd + "T" + hr + ":" + min + ":00";
                urlC = "https://api.todoist.com/sync/v9/completed/get_all?since=" + sinceString + "";

                const responseC = await fetch(urlC, requestOptions);
                const myTasksC = await responseC.text();
                cTasks = JSON.parse(myTasksC);
                if (cTasks.items.length > 0) {
                    for (var i = 0; i < cTasks.items.length; i++) {
                        taskList.push({ id: cTasks.items[i].id, uid: "temp" });
                    }
                }
                extensionAPI.settings.set("ttt:tasksCompleted", JSON.stringify(JSON.parse(myTasksC)));
                extensionAPI.settings.set("ttt:tasksCompleted:time", Date.now());
            } else if (TodoistCompleted && projectID) {
                if (Array.isArray(projectID)) {
                    let id = projectID[1].toString();
                    projectID = id;
                }
                urlC = "https://api.todoist.com/sync/v9/completed/get_all?project_id=" + projectID + "";

                const responseC = await fetch(urlC, requestOptions);
                const myTasksC = await responseC.text();
                cTasks = JSON.parse(myTasksC);
                if (cTasks.items.length > 0) {
                    for (var i = 0; i < cTasks.items.length; i++) {
                        taskList.push({ id: cTasks.items[i].id, uid: "temp" });
                    }
                }
            }

            if (Object.keys(taskList).length > 0) {
                for (var i = 0; i < taskList.length; i++) {
                    for await (task of JSON.parse(myTasks)) {
                        if (taskList[i].id == task.id) {
                            // print task
                            var itemString = "";
                            itemString += "{{[[TODO]]}} ";
                            itemString += "" + task.content + "";
                            if (TodoistPriority == true) {
                                if (task.priority == "4") {
                                    var priority = "1";
                                } else if (task.priority == "3") {
                                    var priority = "2";
                                } else if (task.priority == "2") {
                                    var priority = "3";
                                } else if (task.priority == "1") {
                                    var priority = "4";
                                }
                                itemString += " #Priority-" + priority + "";
                            }/*
                            if (RRTag != undefined) {
                                itemString += " #[["+RRTag+"]]";
                            }*/
                            itemString += " [Link](" + task.url + ")";

                            var thisExtras = [];
                            // print description
                            if (TodoistGetDescription == true && task.description) {
                                thisExtras.push({ "text": task.description.toString(), });
                            }

                            // print comments
                            if (TodoistGetComments == true && task.comment_count > 0) {
                                var url = "https://api.todoist.com/rest/v2/comments?task_id=" + task.id + "";
                                const response = await fetch(url, requestOptions);
                                const myComments = await response.text();
                                let commentsJSON = await JSON.parse(myComments);

                                var commentString = "";
                                for (var j = 0; j < commentsJSON.length; j++) {
                                    commentString = "";
                                    if (commentsJSON[j].attachment != null && TodoistAccount == "Premium") {
                                        if (commentsJSON[j].attachment.file_type == "application/pdf") {
                                            commentString = "{{pdf: " + commentsJSON[j].attachment.file_url + "}}";
                                        } else if (commentsJSON[j].attachment.file_type == "image/jpeg" || commentsJSON[j].attachment.file_type == "image/png") {
                                            commentString = "![](" + commentsJSON[j].attachment.file_url + ")";
                                        } else {
                                            commentString = "" + commentsJSON[j].content + "";
                                            commentString += " [Link](https://todoist.com/showTask?id=" + commentsJSON[j].task_id + "#comment-" + commentsJSON[j].id + ")";
                                        }
                                    } else if (commentsJSON[j].attachment != null) {
                                        if (commentsJSON[j].attachment.file_type == "text/html") {
                                            commentString = "" + commentsJSON[j].content + " [Email Body](" + commentsJSON[j].attachment.file_url + ")";
                                        }
                                    } else {
                                        commentString = "" + commentsJSON[j].content + "";
                                        commentString += " [Link](https://todoist.com/showTask?id=" + commentsJSON[j].task_id + "#comment-" + commentsJSON[j].id + ")";
                                    }

                                    if (commentString.length > 0) {
                                        thisExtras.push({ "text": commentString.toString(), "tID": commentsJSON[j].task_id, "ID": commentsJSON[j].id });
                                    }
                                }
                                comments.push({ "task": task.id, "commentsJSON": commentsJSON })
                            }

                            // print subtasks
                            if (TodoistGetSubtasks == true && subTaskList.length > 0) {
                                for (var k = 0; k < subTaskList.length; k++) {
                                    if (subTaskList[k].parent_id == task.id) {
                                        var subitemString = "";
                                        subitemString += "{{[[TODO]]}} ";
                                        subitemString += "" + subTaskList[k].content + "";
                                        if (TodoistPriority == true) {
                                            if (task.priority == "4") {
                                                var priority = "1";
                                            } else if (task.priority == "3") {
                                                var priority = "2";
                                            } else if (task.priority == "2") {
                                                var priority = "3";
                                            } else if (task.priority == "1") {
                                                var priority = "4";
                                            }
                                            subitemString += " #Priority-" + subTaskList[k].priority + "";
                                        }
                                        subitemString += " [Link](" + subTaskList[k].url + ")";
                                        thisExtras.push({ "text": subitemString.toString(), });
                                    }
                                }
                            }

                            if (thisExtras.length > 0) { // finally, create the string to return
                                output.push({ "text": itemString.toString(), "children": thisExtras });
                            } else {
                                output.push({ "text": itemString.toString(), });
                            }
                        }
                    }
                    if (TodoistCompleted && cTasks.items.length > 0) {
                        for (var j = 0; j < cTasks.items.length; j++) {
                            if (taskList[i].id == cTasks.items[j].id) {
                                // print task
                                var itemString = "{{[[DONE]]}} ";
                                if (completedStrikethrough) {
                                    itemString += "~~";
                                }
                                itemString += cTasks.items[j].content + " [Link](https://todoist.com/showTask?id=" + cTasks.items[j].task_id + ")";
                                if (completedStrikethrough) {
                                    itemString += "~~";
                                }
                                output.push({ "text": itemString.toString(), });
                            }
                        }
                    }
                }

                if (extensionAPI.settings.get("ttt:comments")) {
                    extensionAPI.settings.set("ttt:comments-lastsync", extensionAPI.settings.get("ttt:comments"));
                }
                extensionAPI.settings.set("ttt:comments", JSON.stringify(comments));
                extensionAPI.settings.set("ttt:comments:time", Date.now());

                if (SB) {
                    var header = [];
                    header.push({ "text": TodoistHeader.toString(), "children": output });
                    return header;
                } else if (!auto) {
                    return output;
                } else {
                    parentUid = autoBlockUid;
                    output.forEach((node, order) => {
                        createBlock({
                            parentUid,
                            order,
                            node
                        })
                    }
                    )
                }
            } else {
                if (!auto) {
                    alert("No items to import");
                }
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