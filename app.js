import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import {
    getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBMctSosqF-xfP6J1lVsvD7DbzaO9dcH4s",
    authDomain: "todoapp-abood.firebaseapp.com",
    projectId: "todoapp-abood",
    storageBucket: "todoapp-abood.firebasestorage.app",
    messagingSenderId: "179042915261",
    appId: "1:179042915261:web:099676961b55b0153fb8d4",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const DB_URL = "https://todoapp-abood-default-rtdb.europe-west1.firebasedatabase.app";
// Builds a Firebase link for the signed-in user
async function dbUrl(path) {
    const user = auth.currentUser;
    const token = await user.getIdToken();
    return `${DB_URL}/users/${user.uid}/${path}.json?auth=${token}`;
}


let allLists = [];
let allTasks = [];
let editingId = null;
let currentView = "tasks";


const listForm = document.getElementById("list-form");
const listNameInput = document.getElementById("list-name");
const listError = document.getElementById("list-error");

listForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = listNameInput.value.trim();

    listError.textContent = "";

    if (name === "") {
        listError.textContent = "Please enter a list name.";
        return;
    }

    const exists = allLists.some((list) => list.name.toLowerCase() === name.toLowerCase());
    if (exists) {
        listError.textContent = "This list already exists.";
        return;
    }

    const res = await fetch(await dbUrl("lists"), {
        method: "POST",
        body: JSON.stringify({ name: name }),
    });

    if (!res.ok) {
        console.log("Could not add the list", res.status);
        return;
    }

    listForm.reset();
    loadLists();
});



async function loadLists() {
    const res = await fetch(await dbUrl("lists"));
    if (!res.ok) {
        console.log("Could not load lists", res.status);
        return;
    }
    const data = await res.json();

    allLists = Object.entries(data || {}).map(([id, list]) => ({ id: id, name: list.name }));

    // A new user has no lists: give them a "Personal" list
    if (allLists.length === 0) {
        const addRes = await fetch(await dbUrl("lists"), {
            method: "POST",
            body: JSON.stringify({ name: "Personal" }),
        });
        if (addRes.ok) {
            const created = await addRes.json(); // Firebase answers { name: "the new id" }
            allLists.push({ id: created.name, name: "Personal" });
        }
    }

    renderLists();
}



const listsEl = document.getElementById("lists");
const taskListSelect = document.getElementById("task-list");
let currentList = "all";
let renamingId = null; // the list being renamed (null = none)

function renderLists() {
    listsEl.innerHTML = "";
    taskListSelect.innerHTML = "";

    addListButton("all", "All tasks");

    allLists.forEach((list) => {
        addListButton(list.id, list.name);

        const option = document.createElement("option");
        option.value = list.id;
        option.textContent = list.name;
        taskListSelect.append(option);

    });
    if (currentList !== "all") taskListSelect.value = currentList;

}

function addListButton(id, name) {
    const li = document.createElement("li");

    // This list is being renamed: show a text box instead of the buttons
    if (id === renamingId) {
        const input = document.createElement("input");
        input.className = "list-rename";
        input.value = name;
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") saveListName(id, input.value);
            if (e.key === "Escape") stopRename();
        });
        input.addEventListener("blur", stopRename);
        li.append(input);
        listsEl.append(li);
        return;
    }

    const btn = document.createElement("button");
    btn.dataset.id = id;
    btn.textContent = name;
    if (id === currentList) btn.classList.add("active");
    li.append(btn);

    // Rename and delete buttons (not for "All tasks")
    if (id !== "all") {
        const editBtn = document.createElement("button");
        editBtn.className = "list-edit";
        editBtn.dataset.id = id;
        editBtn.textContent = "✎";
        editBtn.title = "Rename list";

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "list-delete";
        deleteBtn.dataset.id = id;
        deleteBtn.textContent = "✕";
        deleteBtn.title = "Delete list";

        li.append(editBtn, deleteBtn);
    }

    listsEl.append(li);
}

listsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.classList.contains("list-edit")) {
        renameList(id);
        return;
    }
    if (btn.classList.contains("list-delete")) {
        deleteList(id);
        return;
    }

    currentList = id;
    renderLists();
    renderTasks();
});

// ===== RENAME A LIST (a text box inside the sidebar) =====
function renameList(id) {
    renamingId = id;
    renderLists();

    const input = listsEl.querySelector(".list-rename");
    input.focus();
    input.select();
}

async function saveListName(id, value) {
    const name = value.trim();
    listError.textContent = "";

    if (name === "") {
        listError.textContent = "Please enter a list name.";
        return;
    }
    const exists = allLists.some((l) => l.id !== id && l.name.toLowerCase() === name.toLowerCase());
    if (exists) {
        listError.textContent = "This list already exists.";
        return;
    }

    renamingId = null;
    const res = await fetch(await dbUrl(`lists/${id}`), {
        method: "PATCH",
        body: JSON.stringify({ name: name }),
    });
    if (!res.ok) {
        console.log("Could not rename the list", res.status);
        renderLists();
        return;
    }

    await loadLists();
    renderTasks(); // the cards show the list name too
}

function stopRename() {
    if (renamingId === null) return; // already closed
    renamingId = null;
    listError.textContent = "";
    renderLists();
}

// ===== DELETE A LIST (and its tasks) =====
async function deleteList(id) {
    const list = allLists.find((l) => l.id === id);
    const listTasks = allTasks.filter((t) => t.listId === id);

    const ok = confirm(
        `Delete "${list.name}" and its ${listTasks.length} task(s)?\n` +
        "To keep a task, move it to another list first (Edit → List)."
    );
    if (!ok) return;

    for (const task of listTasks) {
        await fetch(await dbUrl(`tasks/${task.id}`), { method: "DELETE" });
    }

    const res = await fetch(await dbUrl(`lists/${id}`), { method: "DELETE" });
    if (!res.ok) {
        console.log("Could not delete the list", res.status);
        return;
    }

    if (currentList === id) currentList = "all";
    resetForm();
    await loadLists();
    await loadTasks();
}


class Task {
    constructor(title, details, listId, dueDate, priority) {
        this.title = title;
        this.details = details;
        this.listId = listId;
        this.dueDate = dueDate;
        this.priority = priority;
        this.completed = false;
        this.deleted = false;
        this.createdAt = Date.now();
    }
}

const taskForm = document.getElementById("task-form");
const taskTitleInput = document.getElementById("task-title");
const taskDetailsInput = document.getElementById("task-details");
const taskDueInput = document.getElementById("task-due");
const taskPriorityInput = document.getElementById("task-priority");

const formTitle = document.getElementById("form-title");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");
const newTaskBtn = document.getElementById("new-task-btn");

const titleError = document.getElementById("title-error");
const taskListError = document.getElementById("task-list-error");
const dueError = document.getElementById("due-error");

function todayString() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function matchesDate(task, when) {
    const today = todayString();
    if (when === "all") return true;
    if (when === "today") return task.dueDate === today;
    if (when === "overdue") return !task.completed && task.dueDate !== "" && task.dueDate < today;
    if (when === "upcoming") return task.dueDate > today;
    if (when === "none") return task.dueDate === "";
    return true;
}
// "Due today", "Due tomorrow", "Overdue · Nov 8" or "Due Nov 24"
function dueLabel(task) {
    const due = new Date(task.dueDate + "T00:00"); // T00:00 = local midnight (not UTC)
    const today = new Date(todayString() + "T00:00");
    const days = Math.round((due - today) / (1000 * 60 * 60 * 24));

    const options = { month: "short", day: "numeric" };
    if (due.getFullYear() !== today.getFullYear()) options.year = "numeric";
    const short = due.toLocaleDateString("en-US", options);

    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    if (days < 0 && !task.completed) return "Overdue · " + short;
    return "Due " + short;
}

const rank = { high: 3, medium: 2, low: 1 };

function compareDates(a, b) {
    if (a.dueDate === "" && b.dueDate === "") return 0;
    if (a.dueDate === "") return 1;
    if (b.dueDate === "") return -1;
    return a.dueDate.localeCompare(b.dueDate);
}

const sorters = {
    newest: (a, b) => b.createdAt - a.createdAt,
    due: compareDates,
    priority: (a, b) => rank[b.priority] - rank[a.priority] || compareDates(a, b),
};

taskForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const task = new Task(
        taskTitleInput.value.trim(),
        taskDetailsInput.value.trim(),
        taskListSelect.value,
        taskDueInput.value,
        taskPriorityInput.value
    );
    titleError.textContent = "";
    taskListError.textContent = "";
    dueError.textContent = "";

    if (task.title === "") {
        titleError.textContent = "Please enter a title.";
        return;
    }
    if (task.title.length > 80) {
        titleError.textContent = "The title must be 80 characters or less.";
        return;
    }
    if (allLists.length === 0) {
        taskListError.textContent = "Create a list first.";
        return;
    }
    if (!editingId && task.dueDate !== "" && task.dueDate < todayString()) {
        dueError.textContent = "The due date can't be in the past.";
        return;
    }
    let res;
    if (editingId) {
        // Edit: change only the 5 fields from the form
        res = await fetch(await dbUrl(`tasks/${editingId}`), {
            method: "PATCH",
            body: JSON.stringify({
                title: task.title,
                details: task.details,
                listId: task.listId,
                dueDate: task.dueDate,
                priority: task.priority,
            }),
        });
    } else {
        // Add: a new task
        res = await fetch(await dbUrl("tasks"), {
            method: "POST",
            body: JSON.stringify(task),
        });
    }

    if (!res.ok) {
        console.log("Could not save the task", res.status);
        return;
    }

    resetForm();
    loadTasks();
});
// Show the form and hide the "+ New task" button
function openForm() {
    taskForm.classList.remove("hide");
    newTaskBtn.classList.add("hide");
    taskTitleInput.focus();
}

newTaskBtn.addEventListener("click", openForm);

// Clear the form, close it, and show the "+ New task" button again
function resetForm() {
    taskForm.reset();
    editingId = null;
    formTitle.textContent = "Add a task";
    submitBtn.textContent = "Add task";
    taskForm.classList.add("hide");
    newTaskBtn.classList.remove("hide");
    titleError.textContent = "";
    taskListError.textContent = "";
    dueError.textContent = "";
    if (currentList !== "all") taskListSelect.value = currentList;
}

cancelBtn.addEventListener("click", resetForm);


async function loadTasks() {
    const res = await fetch(await dbUrl("tasks"));
    if (!res.ok) {
        console.log("Could not load tasks", res.status);
        return;
    }
    const data = await res.json();

    allTasks = Object.entries(data || {}).map(([id, task]) => ({ id: id, ...task }));
    renderTasks();
}


async function start() {
    await loadLists();
    await loadTasks();
}


const tasksEl = document.getElementById("tasks");
const messageEl = document.getElementById("message");

const searchInput = document.getElementById("search");
const filterPriority = document.getElementById("filter-priority");

const filterDate = document.getElementById("filter-date");
const sortSelect = document.getElementById("sort");

searchInput.addEventListener("input", renderTasks);
filterPriority.addEventListener("change", renderTasks);
filterDate.addEventListener("change", renderTasks);
sortSelect.addEventListener("change", renderTasks);

const tabsEl = document.querySelector(".tabs");

tabsEl.addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (!tab) return;

    currentView = tab.dataset.view;
    tabsEl.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    renderTasks();
});

function createTaskCard(task) {
    const card = document.createElement("article");
    card.className = "task " + task.priority;
    card.dataset.id = task.id;
    if (task.completed) card.classList.add("completed");
    if (matchesDate(task, "overdue")) card.classList.add("overdue");

    card.innerHTML = `
    <input type="checkbox" class="task-check">
    <div class="task-body">
      <h3></h3>
      <p></p>
      <div class="task-info">
        <span class="priority"></span>
        <span class="due"></span>
        <span class="list-name"></span>
      </div>
    </div>
    <div class="task-buttons">
      <button class="edit-btn">Edit</button>
      <button class="delete-btn">Move to Trash</button>
    </div>
  `;

    const list = allLists.find((l) => l.id === task.listId);

    card.querySelector("h3").textContent = task.title;
    card.querySelector("p").textContent = task.details;
    card.querySelector(".priority").textContent = task.priority;
    card.querySelector(".list-name").textContent = list ? list.name : "";
    card.querySelector(".task-check").checked = task.completed;

    if (task.dueDate) {
        card.querySelector(".due").textContent = dueLabel(task);
    } else {
        card.querySelector(".due").remove();
    }

    if (task.deleted) {
        card.querySelector(".task-buttons").innerHTML = `
      <button class="restore-btn">Restore</button>
      <button class="delete-forever-btn">Delete forever</button>
    `;
    }

    return card;
}

function renderTasks() {
    const search = searchInput.value.trim().toLowerCase();
    const priority = filterPriority.value;
    const when = filterDate.value;

    const visible = allTasks
        .filter((task) => (currentView === "trash" ? task.deleted : !task.deleted))
        .filter((task) => currentList === "all" || task.listId === currentList)
        .filter((task) => priority === "all" || task.priority === priority)
        .filter((task) => task.title.toLowerCase().includes(search))
        .filter((task) => matchesDate(task, when))
        .sort(sorters[sortSelect.value]);
    tasksEl.innerHTML = "";
    if (visible.length === 0) {
        messageEl.textContent = currentView === "trash" ? "Trash is empty" : "No tasks found";
    } else {
        messageEl.textContent = "";
    }
    visible.forEach((task) => {
        tasksEl.append(createTaskCard(task));
    });

    updateProgress();
}


tasksEl.addEventListener("click", async (e) => {
    const card = e.target.closest(".task");
    if (!card) return;
    const id = card.dataset.id;

    // Complete: the checkbox
    if (e.target.classList.contains("task-check")) {
        const res = await fetch(await dbUrl(`tasks/${id}`), {
            method: "PATCH",
            body: JSON.stringify({ completed: e.target.checked }),
        });

        if (!res.ok) {
            console.log("Could not update the task", res.status);
            return;
        }

        loadTasks();
    }

    // Delete (soft): mark it as deleted
    if (e.target.classList.contains("delete-btn")) {
        if (!confirm("Move this task to the Trash?")) return;

        const res = await fetch(await dbUrl(`tasks/${id}`), {
            method: "PATCH",
            body: JSON.stringify({ deleted: true }),
        });

        if (!res.ok) {
            console.log("Could not delete the task", res.status);
            return;
        }

        loadTasks();
    }
    // Edit: fill the form with this task
    if (e.target.classList.contains("edit-btn")) {
        const task = allTasks.find((t) => t.id === id);

        taskTitleInput.value = task.title;
        taskDetailsInput.value = task.details;
        taskListSelect.value = task.listId;
        taskDueInput.value = task.dueDate;
        taskPriorityInput.value = task.priority;

        editingId = id;
        formTitle.textContent = "Edit task";
        submitBtn.textContent = "Save";
        openForm();
    }
    // Restore: bring it back from the Trash
    if (e.target.classList.contains("restore-btn")) {
        const res = await fetch(await dbUrl(`tasks/${id}`), {
            method: "PATCH",
            body: JSON.stringify({ deleted: false }),
        });

        if (!res.ok) {
            console.log("Could not restore the task", res.status);
            return;
        }

        loadTasks();
    }

    // Delete forever: really remove it from Firebase
    if (e.target.classList.contains("delete-forever-btn")) {
        if (!confirm("Delete this task forever?")) return;

        const res = await fetch(await dbUrl(`tasks/${id}`), {
            method: "DELETE",
        });

        if (!res.ok) {
            console.log("Could not delete the task", res.status);
            return;
        }

        loadTasks();
    }
});


const progressText = document.getElementById("progress-text");
const progressFill = document.getElementById("progress-fill");
const progressEl = document.querySelector(".progress");

function updateProgress() {
    // The bar is about your active tasks, so hide it in the Trash
    progressEl.classList.toggle("hide", currentView === "trash");

    const active = allTasks.filter((task) => !task.deleted && (currentList === "all" || task.listId === currentList));
    const total = active.length;
    const done = active.filter((task) => task.completed).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    progressText.textContent = `${done} of ${total} done`;
    progressFill.style.width = percent + "%";
}
const themeBtn = document.getElementById("theme-btn");

function applyTheme(theme) {
    document.body.classList.toggle("dark", theme === "dark");
    themeBtn.title = theme === "dark" ? "Light mode" : "Dark mode"; // the hint on hover
}

themeBtn.addEventListener("click", () => {
    const theme = document.body.classList.contains("dark") ? "light" : "dark";
    localStorage.setItem("theme", theme);
    applyTheme(theme);
});

applyTheme(localStorage.getItem("theme") || "light");

const signInBtn = document.getElementById("sign-in-btn");
const signOutBtn = document.getElementById("sign-out-btn");
const userBox = document.getElementById("user-box");
const userPhoto = document.getElementById("user-photo");
const userName = document.getElementById("user-name");
const appEl = document.getElementById("app");
const signedOutEl = document.getElementById("signed-out");

signInBtn.addEventListener("click", async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        if (error.code !== "auth/popup-closed-by-user") {
            console.log("Sign-in failed:", error.code);
        }
    }
});

signOutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        signInBtn.classList.add("hide");
        userBox.classList.remove("hide");
        userName.textContent = user.displayName;
        userPhoto.src = user.photoURL;
        signedOutEl.classList.add("hide");
        appEl.classList.remove("hide");

        // Start fresh every time someone signs in
        currentList = "all";       // sidebar → "All tasks"
        currentView = "tasks";     // view → Tasks (not Trash)
        tabsEl.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === "tasks"));
        resetForm();               // form closed, "+ New task" showing

        start();
    } else {
        signInBtn.classList.remove("hide");
        userBox.classList.add("hide");
        signedOutEl.classList.remove("hide");
        appEl.classList.add("hide");
    }
});