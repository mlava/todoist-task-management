let hashChange = undefined;
let keyEventHandler = undefined;
let observer = undefined;
let parentUid = undefined;
var TodoistHeader, key, TodoistOverdue, autoParentUid, autoBlockUid, existingItems, TodoistAccount, TodoistPriority, TodoistGetDescription, TodoistGetComments, TodoistGetSubtasks;
var buttonTrigger;
var checkTDInterval = 0;
var auto = false;
var autoBlockUidLength = 0;

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
                    id: "ttt-auto",
                    name: "Automatic Download",
                    description: "Import items to the DNP automatically",
                    action: {
                        type: "switch",
                        onChange: (evt) => { setAuto(evt); }
                    },
                },
                {
                    id: "ttt-auto-time",
                    name: "Automatic Download interval",
                    description: "Frequency in minutes to check for new items",
                    action: { type: "input", placeholder: "15" },
                },
                {
                    id: "ttt-account",
                    name: "Account type",
                    description: "Account type - turn on if Todoist Premium",
                    action: { type: "switch" },
                },
                {
                    id: "ttt-overdue",
                    name: "Include Overdue",
                    description: "Include tasks that are overdue in Today's tasks",
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
            ]
        };
        extensionAPI.settings.panel.create(config);

        async function setAuto(evt) { // onchange
            if (evt.target.checked) {
                auto = true;
                autoDL();
            } else {
                auto = false;
                if (checkTDInterval > 0) clearInterval(checkTDInterval);
            }
        }

        if (extensionAPI.settings.get("ttt-auto") == true) { // onload
            auto = true;
            autoDL();
        }
        if (extensionAPI.settings.get("ttt-import-header")) { // onload
            TodoistHeader = extensionAPI.settings.get("ttt-import-header");
        } else {
            TodoistHeader = "Imported tasks";
        }

        window.roamAlphaAPI.ui.commandPalette.addCommand({
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
                        blocks.forEach((node, order) => createBlock({
                            parentUid,
                            order,
                            node
                        }));
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

        window.roamAlphaAPI.ui.commandPalette.addCommand({
            label: "Create task in Todoist",
            callback: () => createTodoistTask(),
        });
        window.roamAlphaAPI.ui.commandPalette.addCommand({
            label: "Link to Todoist project via clipboard",
            callback: () => linkTodoistProject(),
        });
        window.roamAlphaAPI.ui.commandPalette.addCommand({
            label: "Reschedule task(s) in Todoist",
            callback: () => moveTask(),
        });
        window.roamAlphaAPI.ui.blockContextMenu.addCommand({
            label: "Reschedule task(s) in Todoist",
            callback: (e) => moveTask(e),
        });

        initiateObserver();

        keyEventHandler = function (e) {
            if (e.code === 'KeyI' && e.shiftKey && e.altKey) {
                return importTodoistTasks();
            }
        }
        window.addEventListener('keydown', keyEventHandler, false);

        async function initiateObserver() {
            const targetNode1 = document.getElementsByClassName("roam-main")[0];
            const targetNode2 = document.getElementById("right-sidebar");
            const config = { attributes: false, childList: true, subtree: true };
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
                            var taskIDClose = taskData[1].slice(0, 10);
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
                            var taskIDReopen = taskData[1].slice(0, 10);
                            var rrUID = mutation.target?.id.slice(-9);
                            reopenTask(taskIDReopen, taskString, rrUID, taskUrl);
                        }
                    }
                }
            };
            observer = new MutationObserver(callback);
            observer.observe(targetNode1, config);
            observer.observe(targetNode2, config);
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
                    taskID = taskID.slice(0,10);
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
                            {location: { "parent-uid": headerBlockUid, order: j }, block: { uid: uidArray[j].uid.toString() } });

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
        };

        function importTodoistTasksSB() {
            return importTodoistTasks(false, true)
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
                        autoBlockUid = await window.roamAlphaAPI.q(`[:find ?u :where [?b :block/page ?p] [?b :block/uid ?u] [?b :block/string "${TodoistHeader}"] [?p :block/uid "${autoParentUid}"]]`)?.[0]?.[0];
                        if (autoBlockUid == undefined) {
                            const uid = window.roamAlphaAPI.util.generateUID();
                            await window.roamAlphaAPI.createBlock({
                                location: { "parent-uid": autoParentUid, order: 9999 },
                                block: { string: TodoistHeader, uid }
                            });
                            autoBlockUid = uid;
                        }

                        existingItems = await window.roamAlphaAPI.q(`[:find (pull ?page [:node/title :block/string :block/uid {:block/children ...} ]) :where [?page :block/uid "${autoBlockUid}"] ]`);
                        if (existingItems != null && existingItems[0][0].hasOwnProperty("children")) {
                            for (var i = 0; i < existingItems[0][0].children.length; i++) {
                                await window.roamAlphaAPI.deleteBlock({ "block": { "uid": existingItems[0][0].children[i].uid } });
                            }
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
                    return importTasks(myToken, TodoistHeader, TodoistOverdue, TodoistPriority, TodoistGetDescription, projectID, DNP, currentPageUID, auto, autoBlockUid, SB);
                }
            }
        }

        async function autoDL() {
            console.info("setting automatic download");
            const regex = /^\d{1,2}$/;
            if (regex.test(extensionAPI.settings.get("ttt-auto-time"))) {
                var checkEveryMinutes = extensionAPI.settings.get("ttt-auto-time");
            } else {
                var checkEveryMinutes = "15";
            }

            setTimeout(async () => {
                await importTodoistTasks(auto);
                try { if (checkTDInterval > 0) clearInterval(checkTDInterval) } catch (e) { }
                checkTDInterval = setInterval(async () => {
                    await importTodoistTasks(auto)
                }, checkEveryMinutes * 60000);
            }, 10000)
        }

        async function createTodoistTask() {
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
                    var startBlock = await window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
                    if (!startBlock) {
                        alert("Your cursor must be within a block to create as a task in Todoist")
                    }
                    let q = `[:find (pull ?page
                        [:node/title :block/string :block/uid :children/view-type
                         :block/order {:block/children ...} {:block/parents ...}
                        ])
                     :where [?page :block/uid "${startBlock}"]  ]`;
                    var block = await window.roamAlphaAPI.q(q);
                    let parentNumber = parseInt(block[0][0].parents.length) - 1;
                    let parentUID = block[0][0].parents[parentNumber].uid;
                    let blockOrder = parseInt(block[0][0].order) + 1;
                    var projectID;
                    var projectIDText = "projectID: ";

                    var myHeaders = new Headers();
                    var bearer = 'Bearer ' + myToken;
                    myHeaders.append("Authorization", bearer);
                    myHeaders.append("Content-Type", "application/json");
                    const regexContent = /^\{\{\[\[TODO\]\]\}\}.+$/;
                    if (regexContent.test(block[0][0].string)) {
                        var taskContent = block[0][0].string.split("{{[[TODO]]}}");
                        var taskString = '{"content": "' + taskContent[1] + '"';
                    } else {
                        var taskString = '{"content": "' + block[0][0].string + '"';
                    }
                    var url = "https://api.todoist.com/rest/v2/tasks";

                    const regex = /^\d{2}-\d{2}-\d{4}$/;
                    const regex1 = /^https:\/\/roamresearch.com\/#\/(app|offline)\/\w+$/; //today's DNP
                    var uri = window.location.href;
                    if (regex.test(block[0][0].parents[0].uid)) { // this is a DNP, set a due date
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

                    var requestOptions = {
                        method: 'POST',
                        headers: myHeaders,
                        body: taskString
                    };
                    const response = await fetch(url, requestOptions);
                    const myTasks = await response.text();
                    var task = JSON.parse(myTasks);
                    var newTaskString = "";

                    newTaskString += "{{[[TODO]]}} ";
                    newTaskString += "" + task.content + "";
                    newTaskString += " [Link](" + task.url + ")";
                    await window.roamAlphaAPI.updateBlock({
                        block: {
                            uid: startBlock,
                            string: newTaskString.toString()
                        }
                    });
                    await window.roamAlphaAPI.ui.setBlockFocusAndSelection();
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
                var completedTaskString = "{{[[DONE]]}} ~~" + taskString.trim() + " [Link](" + taskUrl + ")~~";
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
                    var reopenedTaskString = "{{[[TODO]]}} " + taskString.trim() + " [Link](" + taskUrl + ")";
                    await window.roamAlphaAPI.updateBlock(
                        { block: { uid: blockUID, string: reopenedTaskString.toString(), open: true } });
                    console.log("Task reopened in Todoist");
                }
                await sleep(50);
                initiateObserver();
            }
        }
    },
    onunload: () => {
        window.roamAlphaAPI.ui.commandPalette.removeCommand({
            label: 'Import tasks from Todoist'
        });
        window.roamAlphaAPI.ui.commandPalette.removeCommand({
            label: 'Create task in Todoist'
        });
        window.roamAlphaAPI.ui.commandPalette.removeCommand({
            label: 'Link to Todoist project via clipboard'
        });
        window.roamAlphaAPI.ui.commandPalette.removeCommand({
            label: 'Reschedule task(s) in Todoist'
        });
        window.roamAlphaAPI.ui.blockContextMenu.removeCommand({
            label: "Reschedule task(s) in Todoist"
        });
        if (window.roamjs?.extension?.smartblocks) {
            window.roamjs.extension.smartblocks.unregisterCommand("IMPORTTODOIST");
            window.roamjs.extension.smartblocks.unregisterCommand("REFRESHTODOIST");
        };
        // window.removeEventListener('hashchange', hashChange);
        observer.disconnect();
        window.removeEventListener('keydown', keyEventHandler, false);
    }
}

async function importTasks(myToken, TodoistHeader, TodoistOverdue, TodoistPriority, TodoistGetDescription, projectID, DNP, currentPageUID, auto, autoBlockUid, SB) {
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
            url = "https://api.todoist.com/rest/v2/tasks?project_id=" + projectID[1];
        } else {
            url = "https://api.todoist.com/rest/v2/tasks?project_id=" + projectID;
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

    var myHeaders = new Headers();
    var bearer = 'Bearer ' + myToken;
    myHeaders.append("Authorization", bearer);
    myHeaders.append("Content-Type", "application/json");
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

    for await (task of JSON.parse(myTasks)) {
        if (task.hasOwnProperty("parent_id") && task.parent_id != null) {
            subTaskList.push({ id: task.id, parent_id: task.parent_id, order: task.order, content: task.content, url: task.url, priority: task.priority });
        } else {
            taskList.push({ id: task.id, uid: "temp" });
        }
    }

    const date = new Date();
    date.setHours(0, 0, 0, 0);
    const sinceDate = new Date(date.setMinutes(date.getMinutes() - date.getTimezoneOffset()));
    let year = sinceDate.getFullYear();
    var dd = String(sinceDate.getDate()).padStart(2, '0');
    var mm = String(sinceDate.getMonth() + 1).padStart(2, '0');
    var hr = String(sinceDate.getHours()).padStart(2, '0');
    var min = String(sinceDate.getMinutes()).padStart(2, '0');
    const sinceString = "" + year + "-" + mm + "-" + dd + "T" + hr + ":" + min + ":00";
    urlC = "https://api.todoist.com/sync/v9/completed/get_all?since=" + sinceString + "";

    const responseC = await fetch(urlC, requestOptions);
    const myTasksC = await responseC.text();
    let cTasks = JSON.parse(myTasksC);
    if (cTasks.items.length > 0) {
        for (var i = 0; i < cTasks.items.length; i++) {
            taskList.push({ id: cTasks.items[i].id, uid: "temp" });
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
                    }
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
                                }
                            } else if (commentsJSON[j].attachment != null) {
                                if (commentsJSON[j].attachment.file_type == "text/html") {
                                    commentString = "" + commentsJSON[j].content + " [Email Body](" + commentsJSON[j].attachment.file_url + ")";
                                }
                            } else {
                                commentString = "" + commentsJSON[j].content + "";
                            }

                            if (commentString.length > 0) {
                                thisExtras.push({ "text": commentString.toString(), });
                            }
                        }
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
            if (cTasks.items.length > 0) {
                for (var j = 0; j < cTasks.items.length; j++) {
                    if (taskList[i].id == cTasks.items[j].id) {
                        // print task
                        var itemString = "";
                        itemString += "{{[[DONE]]}} ";
                        itemString += "~~" + cTasks.items[j].content + "";
                        itemString += " [Link](https://todoist.com/showTask?id=" + cTasks.items[j].task_id + ")~~";

                        output.push({ "text": itemString.toString(), });
                    }
                }
            }
        }

        if (SB) {
            var header = [];
            header.push({ "text": TodoistHeader.toString(), "children": output });
            return header;
        } else if (!auto) {
            return output;
        } else {
            parentUid = autoBlockUid;
            output.forEach((node, order) => createBlock({
                parentUid,
                order,
                node
            }))
        }
    } else {
        alert("No items to import");
    }
}

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