const PLAN_URL = 'plan.json';
const STORAGE_KEY = 'walking-roller-plan-progress-v1';

async function loadPlan() {
  const response = await fetch(PLAN_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Could not load ${PLAN_URL}`);
  }
  return response.json();
}

function getProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function flattenTasks(plan) {
  return plan.weeks.flatMap((week) =>
    week.days.flatMap((day) =>
      day.tasks.map((task) => ({
        id: task.id,
        weekId: week.id,
        category: task.category,
      }))
    )
  );
}

function percentage(done, total) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

function renderSummary(plan, progress) {
  const summaryGrid = document.getElementById('summary-grid');
  const tasks = flattenTasks(plan);
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((task) => progress[task.id]).length;

  const walkTasks = tasks.filter((task) => task.category === 'walk');
  const rollerTasks = tasks.filter((task) => task.category === 'roller');

  summaryGrid.innerHTML = `
    <article class="summary-card">
      <h2>Overall progress</h2>
      <div class="big-number">${doneTasks}/${totalTasks}</div>
      <p>${percentage(doneTasks, totalTasks)}% completed</p>
    </article>
    <article class="summary-card">
      <h2>Walking tasks</h2>
      <div class="big-number">${walkTasks.filter((task) => progress[task.id]).length}/${walkTasks.length}</div>
      <p>Daily steps and focused walking sessions</p>
    </article>
    <article class="summary-card">
      <h2>Ab roller tasks</h2>
      <div class="big-number">${rollerTasks.filter((task) => progress[task.id]).length}/${rollerTasks.length}</div>
      <p>Short, controlled core sessions</p>
    </article>
    <article class="summary-card">
      <h2>Current plan version</h2>
      <div class="big-number">${plan.planTitle.match(/\d+/)?.[0] || '4'}</div>
      <p>${plan.planTitle}</p>
    </article>
  `;
}

function renderPlan(plan, progress) {
  const container = document.getElementById('plan-container');
  const weekTemplate = document.getElementById('week-template');
  const dayTemplate = document.getElementById('day-template');
  const taskTemplate = document.getElementById('task-template');

  container.innerHTML = '';

  for (const week of plan.weeks) {
    const weekNode = weekTemplate.content.firstElementChild.cloneNode(true);
    weekNode.dataset.weekId = week.id;
    weekNode.querySelector('.week-label').textContent = week.label;
    weekNode.querySelector('h2').textContent = week.title;
    weekNode.querySelector('.week-goal').textContent = week.goal;
    weekNode.querySelector('.week-notes').textContent = week.notes || '';

    const daysWrap = weekNode.querySelector('.days');

    let weekTaskCount = 0;
    let weekDoneCount = 0;

    for (const day of week.days) {
      const dayNode = dayTemplate.content.firstElementChild.cloneNode(true);
      dayNode.querySelector('.day-name').textContent = day.dayName;
      dayNode.querySelector('h3').textContent = day.title;
      dayNode.querySelector('.day-focus').textContent = day.focus;

      const taskList = dayNode.querySelector('.task-list');

      for (const task of day.tasks) {
        const taskNode = taskTemplate.content.firstElementChild.cloneNode(true);
        const isDone = Boolean(progress[task.id]);
        taskNode.dataset.taskId = task.id;
        taskNode.querySelector('h4').textContent = task.title;
        taskNode.querySelector('.task-description').textContent = task.description;
        taskNode.querySelector('.task-detail').textContent = task.detail || '';

        const button = taskNode.querySelector('.done-button');
        button.dataset.taskId = task.id;
        updateTaskButton(taskNode, button, isDone);

        button.addEventListener('click', () => {
          const latestProgress = getProgress();
          latestProgress[task.id] = !latestProgress[task.id];
          saveProgress(latestProgress);
          refresh(plan);
        });

        if (isDone) weekDoneCount += 1;
        weekTaskCount += 1;
        taskList.appendChild(taskNode);
      }

      daysWrap.appendChild(dayNode);
    }

    const weekPercent = percentage(weekDoneCount, weekTaskCount);
    weekNode.querySelector('.week-progress-text').textContent = `${weekDoneCount}/${weekTaskCount} done · ${weekPercent}%`;
    weekNode.querySelector('.progress-bar span').style.width = `${weekPercent}%`;

    container.appendChild(weekNode);
  }
}

function updateTaskButton(taskNode, button, isDone) {
  taskNode.classList.toggle('done', isDone);
  button.classList.toggle('is-done', isDone);
  button.setAttribute('aria-pressed', String(isDone));
  button.textContent = isDone ? 'Done ✓' : 'Done it';
}

function refresh(plan) {
  const progress = getProgress();
  renderSummary(plan, progress);
  renderPlan(plan, progress);
}

function setupReset(plan) {
  document.getElementById('reset-progress').addEventListener('click', () => {
    const confirmed = window.confirm('Reset all saved progress for this plan?');
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    refresh(plan);
  });
}

async function init() {
  try {
    const plan = await loadPlan();
    refresh(plan);
    setupReset(plan);
  } catch (error) {
    document.getElementById('plan-container').innerHTML = `
      <section class="week-card">
        <h2>Could not load the plan</h2>
        <p>${error.message}</p>
      </section>
    `;
  }
}

init();
