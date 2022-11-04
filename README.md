This extension allows you to manage your Todoist tasks from within your Roam Research graph.

**NEW:**  BETA: Automatic sync of daily tasks in both directions!
- Set a configurable interval and the extension will update tasks from Todoist automatically to your DNP. If you complete a task in Todoist it should update in your RR graph. You can still complete tasks in Roam Research and have that sync to Todoist, and uncomplete of tasks in RR will also update the task in Todoist. The only limitation is that you can't uncomplete a recurring task as the Todoist API won't allow for that.
- Option to create a link back to the Roam Research block on creating a task in Todoist. Turned off by default. Creates a link to the RR block reference in the description field of the Todoist task.

This version allows:

1. import tasks by automatically sensing the date of a DNP and only bringing relevant tasks, using the Command Palette command 'Import tasks from Todoist'. 
2. you can also import using the SmartBlock command <%IMPORTTODOIST%>. Or create a button to trigger the SmartBlock and have this in your daily template.
3. create tasks within Roam Research and push them to Todoist using a Command Palette command 'Create task in Todoist'
4. complete tasks in Roam by checking the TODO checkbox, and automatically complete the same task in Todoist
5. link a RR project page to a project in Todoist and import, create and complete tasks for that project within Roam. Use the Command Palette command 'Link to Todoist project via clipboard'
6. reschedule tasks by using the Command Palette command Reschedule task in Todoist. A datepicker popover will appear and if you select a new date the task will be rescheduled in Todoist and moved to the correct page in your Roan Research graph.

This video shows most of this in action:

https://www.loom.com/share/eecfe93ec49844ab9ec0f58ee301a75b

TODO:
1. implement keyboard shortcuts for each Command Palette command
