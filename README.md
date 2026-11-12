# ToDoApp

A to-do app where each user signs in with Google and manages their own lists and tasks.
Built with plain HTML, CSS and JavaScript, with Firebase as the backend.

**Live demo:** https://abd-alrhmanfayyad.github.io/ToDoApp/

## Features

### Tasks
- Add, edit and complete tasks. The form opens with **+ New task** and closes when you save or cancel
- Each task has a title, details, a list, a due date and a priority (High, Medium, Low)
- Easy-to-read dates: **Due today**, **Due tomorrow**, **Due Nov 24**, **Overdue · Nov 8**
- **Soft delete:** a deleted task goes to the **Trash**, where you can **restore** it or **delete it forever**

### Lists
- Create your own lists (for example Work, Home). A new user starts with a **Personal** list
- **Rename** a list right in the sidebar (Enter saves, Esc cancels)
- **Delete** a list together with its tasks, after a confirm that says how many tasks will go
- Click a list to see only its tasks, or **All tasks** to see everything

### Search, filter and sort
- Search tasks by title
- Filter by priority, and by due date: Today, Overdue, Upcoming, No date
- Sort by newest, due date or priority

### Extras
- **Google sign-in:** each user sees only their own lists and tasks
- **Overdue tasks** are marked in red
- **Progress bar** that shows how many tasks are done in the selected list ("2 of 5 done")
- **Dark mode**, remembered with `localStorage`
- Works on phones: the layout changes to one column on small screens
- **Validation** with clear messages under each field:
  - empty list name, or a list that already exists
  - empty title, or a title longer than 80 characters
  - adding a task before creating a list
  - a due date in the past

## Built with
- HTML, CSS and JavaScript (no frameworks)
- **Firebase Realtime Database**, through its REST API with `fetch` (GET, POST, PATCH, DELETE)
- **Firebase Authentication** (Google sign-in)
- **GitHub Pages** for hosting

## How it works

Each user has their own folder in the database:

```
users/
  {uid}/
    lists/
      {listId}: { name }
    tasks/
      {taskId}: { title, details, listId, dueDate, priority, completed, deleted, createdAt }
```

- Every request goes to `users/{uid}/...` and sends the user's **ID token** (`?auth=...`), so Firebase knows who is asking.
- **Soft delete** is a `PATCH` with `{ deleted: true }`. Restore sets it back to `false`. Delete forever is a real `DELETE`.
- **Security Rules** on the Firebase server let a signed-in user read and write **only their own folder**:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    }
  }
}
```

> The Firebase config in `app.js` is public by design. It only identifies the project; the data is protected by the Security Rules above.

## Run it locally
1. Clone the repo:
   ```bash
   git clone https://github.com/abd-alrhmanfayyad/ToDoApp.git
   ```
2. Open the folder in VS Code and start **Live Server**.
   `app.js` is a JavaScript module, so opening `index.html` directly as a file will not work.
3. Open the page Live Server gives you (for example `http://127.0.0.1:5500`) and sign in with Google.

## Project structure
| File | What it does |
|---|---|
| `index.html` | Page layout |
| `style.css` | Styles, light and dark themes |
| `app.js` | All the logic: Firebase, lists, tasks, filters, sign-in |
| `README.md` | This file |

## Author
**Abd-alrhman Fayyad**, training task at Orange Coding Academy

GitHub: [abd-alrhmanfayyad](https://github.com/abd-alrhmanfayyad)