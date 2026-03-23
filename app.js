const PLAN_URL = 'plan.json';
const STORAGE_KEY = 'walking-roller-plan-progress-v1';

// Supabase client – initialised in initSupabase() when credentials are present
let _supabase = null;
let currentUser = null;
let currentPlan = null;

function initSupabase() {
  if (
    typeof window.supabase !== 'undefined' &&
    typeof SUPABASE_URL !== 'undefined' &&
    SUPABASE_URL !== 'YOUR_SUPABASE_URL'
  ) {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function signInWithGoogle() {
  if (!_supabase) return;
  await _supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href },
  });
}

async function signOut() {
  if (!_supabase) return;
  await _supabase.auth.signOut();
}

function renderAuthUI(user) {
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const userDisplay = document.getElementById('user-display');

  if (user) {
    loginBtn.hidden = true;
    logoutBtn.hidden = false;
    userDisplay.hidden = false;
    userDisplay.textContent = user.user_metadata?.full_name || user.email || 'Signed in';
  } else {
    loginBtn.hidden = false;
    logoutBtn.hidden = true;
    userDisplay.hidden = true;
  }
}

// ── Progress storage ──────────────────────────────────────────────────────────

async function getProgress() {
  if (currentUser && _supabase) {
    const { data, error } = await _supabase
      .from('progress')
      .select('task_id')
      .eq('user_id', currentUser.id)
      .eq('completed', true);
    if (!error && data) {
      return Object.fromEntries(data.map((r) => [r.task_id, true]));
    }
  }
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

async function toggleTask(taskId) {
  const progress = await getProgress();
  const newValue = !progress[taskId];

  if (currentUser && _supabase) {
    const { error } = await _supabase.from('progress').upsert(
      {
        user_id: currentUser.id,
        task_id: taskId,
        completed: newValue,
        completed_at: newValue ? new Date().toISOString() : null,
      },
      { onConflict: 'user_id,task_id' }
    );
    if (error) console.error('Error saving progress:', error);
    return;
  }

  progress[taskId] = newValue;
  if (!newValue) delete progress[taskId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

async function resetProgress() {
  if (currentUser && _supabase) {
    const { error } = await _supabase
      .from('progress')
      .delete()
      .eq('user_id', currentUser.id);
    if (error) console.error('Error resetting progress:', error);
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
}

// ── Plan loading ──────────────────────────────────────────────────────────────

async function loadPlan() {
  const response = await fetch(PLAN_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Could not load ${PLAN_URL}`);
  }
  return response.json();
}

// ── Rendering ─────────────────────────────────────────────────────────────────

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

        button.addEventListener('click', async () => {
          button.disabled = true;
          await toggleTask(task.id);
          await refresh(plan);
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

async function refresh(plan) {
  const progress = await getProgress();
  renderSummary(plan, progress);
  renderPlan(plan, progress);
}

function setupReset(plan) {
  document.getElementById('reset-progress').addEventListener('click', async () => {
    const confirmed = window.confirm('Reset all saved progress for this plan?');
    if (!confirmed) return;
    await resetProgress();
    await refresh(plan);
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  initSupabase();

  if (_supabase) {
    // Re-render whenever the auth state changes (e.g. after OAuth redirect)
    _supabase.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session?.user ?? null;
      renderAuthUI(currentUser);
      if (currentPlan) {
        await refresh(currentPlan);
      }
    });

    // Restore any existing session
    const {
      data: { session },
    } = await _supabase.auth.getSession();
    currentUser = session?.user ?? null;
    renderAuthUI(currentUser);
  } else {
    // Supabase not configured – hide auth buttons
    document.getElementById('login-btn').hidden = true;
  }

  document.getElementById('login-btn').addEventListener('click', signInWithGoogle);
  document.getElementById('logout-btn').addEventListener('click', signOut);

  try {
    const plan = await loadPlan();
    currentPlan = plan;
    await refresh(plan);
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
