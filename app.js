const DB_URL = "https://todoapp-abood-default-rtdb.europe-west1.firebasedatabase.app";

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

    const res = await fetch(`${DB_URL}/lists.json`, {
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
    const res = await fetch(`${DB_URL}/lists.json`);
    if (!res.ok) {
        console.log("Could not load lists", res.status);
        return;
    }
    const data = await res.json();

    allLists = Object.entries(data || {}).map(([id, list]) => ({ id: id, name: list.name }));
    renderLists();
}



const listsEl = document.getElementById("lists");
const taskListSelect = document.getElementById("task-list");
let currentList = "all";

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
    const btn = document.createElement("button");
    btn.dataset.id = id;
    btn.textContent = name;
    if (id === currentList) btn.classList.add("active");
    li.append(btn);
    listsEl.append(li);
}

listsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    currentList = btn.dataset.id;
    renderLists();
    renderTasks();
});


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
        res = await fetch(`${DB_URL}/tasks/${editingId}.json`, {
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
        res = await fetch(`${DB_URL}/tasks.json`, {
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
function resetForm() {
    taskForm.reset();
    editingId = null;
    formTitle.textContent = "Add a task";
    submitBtn.textContent = "Add task";
    cancelBtn.classList.add("hide");
    titleError.textContent = "";
    taskListError.textContent = "";
    dueError.textContent = "";
    if (currentList !== "all") taskListSelect.value = currentList;
}

cancelBtn.addEventListener("click", resetForm);


async function loadTasks() {
    const res = await fetch(`${DB_URL}/tasks.json`);
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
      <button class="delete-btn">Delete</button>
    </div>
  `;

    const list = allLists.find((l) => l.id === task.listId);

    card.querySelector("h3").textContent = task.title;
    card.querySelector("p").textContent = task.details;
    card.querySelector(".priority").textContent = task.priority;
    card.querySelector(".list-name").textContent = list ? list.name : "";
    card.querySelector(".task-check").checked = task.completed;

    if (task.dueDate) {
        card.querySelector(".due").textContent = "Due " + task.dueDate;
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
    } visible.forEach((task) => {
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
        const res = await fetch(`${DB_URL}/tasks/${id}.json`, {
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
        if (!confirm("Delete this task?")) return;

        const res = await fetch(`${DB_URL}/tasks/${id}.json`, {
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
        cancelBtn.classList.remove("hide");
        taskTitleInput.focus();
    }
        // Restore: bring it back from the Trash
    if (e.target.classList.contains("restore-btn")) {
        const res = await fetch(`${DB_URL}/tasks/${id}.json`, {
            method: "PATCH",
            body: JSON.stringify({ deleted: false}),
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

        const res = await fetch(`${DB_URL}/tasks/${id}.json`, {
            method: "DELETE",        });

        if (!res.ok) {
            console.log("Could not delete the task", res.status);
            return;
        }

        loadTasks();
    }
});


const progressText = document.getElementById("progress-text");
const progressFill = document.getElementById("progress-fill");

function updateProgress() {
    const active = allTasks.filter((task) => !task.deleted);
    const total = active.length;
    const done = active.filter((task) => task.completed).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    progressText.textContent = `${done} of ${total} done`;
    progressFill.style.width = percent + "%";
}
const themeBtn = document.getElementById("theme-btn");

function applyTheme(theme) {
    document.body.classList.toggle("dark", theme === "dark");
    themeBtn.textContent = theme === "dark" ? "Light mode" : "Dark mode";
}

themeBtn.addEventListener("click", () => {
    const theme = document.body.classList.contains("dark") ? "light" : "dark";
    localStorage.setItem("theme", theme);
    applyTheme(theme);
});

applyTheme(localStorage.getItem("theme") || "light");

start();