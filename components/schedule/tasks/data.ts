import { Todo } from "./types"

export const tasksData: Todo[] = [
  {
    id: "4",
    title: "Design homepage layout",
    description: "Create wireframes and mockups for the homepage",
    assignedTo: ["Emily Carter", "Liam Walker"],
    comments: [
      {
        id: "c3",
        text: "Consider using a grid layout for responsiveness",
        createdAt: new Date("2023-05-20T00:00:00.000Z")
      }
    ],
    status: "in-progress",
    priority: "high",
    createdAt: new Date("2023-05-18T00:00:00.000Z"),
    dueDate: new Date("2023-06-05T00:00:00.000Z"),
    reminderDate: new Date("2023-05-30T00:00:00.000Z"),
    subTasks: [
      { id: "st4", title: "Sketch wireframe", completed: true },
      { id: "st5", title: "Create high-fidelity mockup", completed: false }
    ],
    files: [],
    starred: true
  },
  {
    id: "5",
    title: "Conduct user interviews",
    description: "Schedule and conduct interviews with 5 users",
    assignedTo: ["Liam Walker"],
    comments: [],
    status: "pending",
    priority: "medium",
    createdAt: new Date("2023-05-22T00:00:00.000Z"),
    dueDate: new Date("2023-06-12T00:00:00.000Z"),
    reminderDate: new Date("2023-06-10T00:00:00.000Z"),
    subTasks: [
      { id: "st6", title: "Prepare interview questions", completed: true },
      { id: "st7", title: "Send invites", completed: false }
    ],
    files: [],
    starred: false
  },
  {
    id: "6",
    title: "Write unit tests",
    description: "Add unit tests for authentication module",
    assignedTo: ["Sophie Lee"],
    comments: [
      {
        id: "c4",
        text: "Make sure to cover edge cases",
        createdAt: new Date("2023-05-25T00:00:00.000Z")
      }
    ],
    status: "in-progress",
    priority: "high",
    createdAt: new Date("2023-05-24T00:00:00.000Z"),
    dueDate: new Date("2023-06-07T00:00:00.000Z"),
    reminderDate: new Date("2023-06-05T00:00:00.000Z"),
    subTasks: [
      { id: "st8", title: "Write tests for login", completed: false },
      { id: "st9", title: "Write tests for logout", completed: false }
    ],
    files: [],
    starred: true
  },
  {
    id: "7",
    title: "Prepare launch checklist",
    description: "Create a checklist of items before launch day",
    assignedTo: ["Daniel Kim", "Olivia Adams"],
    comments: [],
    status: "pending",
    priority: "low",
    createdAt: new Date("2023-05-27T00:00:00.000Z"),
    dueDate: new Date("2023-06-20T00:00:00.000Z"),
    reminderDate: undefined,
    subTasks: [
      { id: "st10", title: "Domain verification", completed: false }
    ],
    files: [],
    starred: false
  },
  {
    id: "8",
    title: "Update privacy policy",
    description: "Add GDPR compliance section",
    assignedTo: ["Olivia Adams"],
    comments: [
      {
        id: "c5",
        text: "Consult with the legal team for accuracy",
        createdAt: new Date("2023-05-29T00:00:00.000Z")
      }
    ],
    status: "in-progress",
    priority: "medium",
    createdAt: new Date("2023-05-28T00:00:00.000Z"),
    dueDate: new Date("2023-06-14T00:00:00.000Z"),
    reminderDate: new Date("2023-06-12T00:00:00.000Z"),
    subTasks: [
      { id: "st11", title: "Review existing policy", completed: true },
      { id: "st12", title: "Add new GDPR section", completed: false }
    ],
    files: [],
    starred: false
  },
  {
    id: "9",
    title: "Deploy to staging",
    description: "Deploy the latest build to the staging environment",
    assignedTo: ["Noah Bennett"],
    comments: [],
    status: "completed",
    priority: "high",
    createdAt: new Date("2023-05-30T00:00:00.000Z"),
    dueDate: new Date("2023-06-02T00:00:00.000Z"),
    reminderDate: new Date("2023-05-30T00:00:00.000Z"),
    subTasks: [
      { id: "st13", title: "Merge main branch", completed: true },
      { id: "st14", title: "Trigger CI/CD", completed: true }
    ],
    files: [],
    starred: true
  },
  {
    id: "10",
    title: "Organize team retro",
    description: "Plan and host the sprint retrospective meeting",
    assignedTo: ["Mia Turner", "Olivia Adams"],
    comments: [],
    status: "pending",
    priority: "low",
    createdAt: new Date("2023-06-01T00:00:00.000Z"),
    dueDate: new Date("2023-06-10T00:00:00.000Z"),
    reminderDate: new Date("2023-06-09T00:00:00.000Z"),
    subTasks: [
      { id: "st15", title: "Book meeting room", completed: false },
      { id: "st16", title: "Prepare feedback board", completed: false }
    ],
    files: [],
    starred: false
  },
  {
    id: "11",
    title: "Refactor dashboard UI",
    description: "Improve layout and responsiveness of the dashboard page",
    assignedTo: ["Lucas Evans", "Mia Turner", "Olivia Adams"],
    comments: [
      {
        id: "c6",
        text: "Don't forget mobile breakpoints",
        createdAt: new Date("2023-06-03T00:00:00.000Z")
      }
    ],
    status: "in-progress",
    priority: "high",
    createdAt: new Date("2023-06-02T00:00:00.000Z"),
    dueDate: new Date("2023-06-18T00:00:00.000Z"),
    reminderDate: new Date("2023-06-15T00:00:00.000Z"),
    subTasks: [
      { id: "st17", title: "Fix sidebar behavior", completed: true },
      { id: "st18", title: "Adjust grid layout", completed: false }
    ],
    files: [],
    starred: true
  }
]
