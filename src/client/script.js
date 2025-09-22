function renderCompanyRow(company) {
  return `<tr class="hover:bg-[var(--table-hover)]">
        <td class="px-4 py-2 border border-[var(--border-color)] text-gray-200">
            <ul>${company.companyId || ''}</ul>
        </td>
        <td class="px-4 py-2 border border-[var(--border-color)] text-gray-200">
            <ul>${renderGeneral(company.general)}</ul>
        </td>
        <td class="px-4 py-2 border border-[var(--border-color)] text-gray-200">
            <ul>${renderLocation(company.location)}</ul>
        </td>
        <td class="px-4 py-2 border border-[var(--border-color)] text-gray-200">
            <ul>${renderIndustry(company.industry)}</ul>
        </td>
        <td class="px-4 py-2 border border-[var(--border-color)] text-gray-200">
            <ul>${renderOwnership(company.ownership)}</ul>
        </td>
        <td class="px-4 py-2 border border-[var(--border-color)] text-gray-200">
            <ul>${renderAdditionInformation(company)}</ul>
        </td>
            </tr>`;
}

function renderGeneral(general = {}) {
  const items = [];
  if (general.name) items.push(`<li>Name: ${general.name}</li>`);
  if (general.description) items.push(`<li>Description: ${general.description}</li>`);
  if (general.websiteUrl)
    items.push(
      `<li>Website: <a href="${general.websiteUrl}" target="_blank" rel="noopener noreferrer" class="text-[var(--link-color)] underline hover:text-[var(--link-hover)]">${general.websiteUrl}</a></li>`,
    );
  if (general.logoUrl)
    items.push(
      `<li>Logo: <a href="${general.logoUrl}" target="_blank" rel="noopener noreferrer" class="text-[var(--link-color)] underline hover:text-[var(--link-hover)]">${general.logoUrl}</a></li>`,
    );
  if (general.relevantLinks?.length) {
    const links = general.relevantLinks
      .map(
        (link) =>
          `<a href="${link}" target="_blank" rel="noopener noreferrer" class="text-[var(--link-color)] underline hover:text-[var(--link-hover)]">${link}</a>`,
      )
      .join(', ');
    items.push(`<li>Relevant Links: ${links}</li>`);
  }
  return items.join('');
}

function renderLocation(location = {}) {
  const items = [];
  if (location.hq) items.push(`<li>HQ: ${location.hq}</li>`);
  if (location.city) items.push(`<li>City: ${location.city}</li>`);
  if (location.state) items.push(`<li>State: ${location.state}</li>`);
  if (location.country) items.push(`<li>Country: ${location.country}</li>`);
  return items.join('');
}

function renderIndustry(industry = {}) {
  const items = [];
  if (industry.industryType) items.push(`<li>Industry Type: ${industry.industryType}</li>`);
  return items.join('');
}

function renderOwnership(ownership = {}) {
  const items = [];
  if (ownership.operatingRegion?.length)
    items.push(`<li>Operating Regions: ${ownership.operatingRegion.join(', ')}</li>`);
  if (ownership.yearSinceInvestment)
    items.push(`<li>Investment Since: ${ownership.yearSinceInvestment}</li>`);
  if (ownership.assetClasses?.length)
    items.push(`<li>Asset Classes: ${ownership.assetClasses.join(', ')}</li>`);
  return items.join('');
}

function renderAdditionInformation(company = {}) {
  const items = [];
  if (company.general.executiveMembers?.length)
    items.push(`<li>Executive Members: ${company.general.executiveMembers.join(', ')}</li>`);
  if (company.general.employeeCount)
    items.push(`<li>Employee Count: ${company.general.employeeCount}</li>`);
  if (company.ownership.investmentInterest)
    items.push(`<li>Investment Interest: ${company.ownership.investmentInterest}</li>`);

  return items.join('');
}

function toggleButtonLoading(buttonId, show = true) {
  const button = document.getElementById(buttonId);
  const text = button.querySelector('.button-text');
  const loader = button.querySelector('.button-loader');
  if (show) {
    button.disabled = true;
    text.style.opacity = '0.6';
    loader?.classList.remove('hidden');
  } else {
    button.disabled = false;
    text.style.opacity = '1';
    loader?.classList.add('hidden');
  }
}

async function fetchCompanies() {
  await withButtonLoading(['load-data'], async () => {
    const tbody = document.getElementById('company-table-body');
    const table = document.getElementById('company-table');

    const response = await axios.get('/kkr-scraper/companies');
    if (!response.data || !Array.isArray(response.data)) throw new Error('Invalid data format');

    tbody.innerHTML = response.data.map(renderCompanyRow).join('');
    table.style.display = 'table';
  });
}

async function triggerScraping() {
  await withButtonLoading(['trigger-scraping'], async () => {
    const scrapeStatus = document.getElementById('scrape-status');

    await axios.get('/kkr-scraper/portfolio');
    scrapeStatus.textContent = 'Scraping triggered successfully';
    scrapeStatus.style.display = 'block';

    await fetchCompanies();
  });
}

async function withButtonLoading(buttonIds = [], task) {
  const errorMsg = document.getElementById('error-msg');
  const scrapeStatus = document.getElementById('scrape-status');
  const loading = document.getElementById('loading');
  const table = document.getElementById('company-table');

  try {
    buttonIds.forEach((id) => toggleButtonLoading(id, true));
    errorMsg.style.display = 'none';
    scrapeStatus && (scrapeStatus.style.display = 'none');
    loading.style.display = 'block';
    table.style.display = 'none';

    await task();
  } catch (error) {
    console.error('Error:', error);
    errorMsg.textContent = `Error: ${error.message}`;
    errorMsg.style.display = 'block';
  } finally {
    loading.style.display = 'none';
    buttonIds.forEach((id) => toggleButtonLoading(id, false));
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const debouncedFetchCompanies = debounce(fetchCompanies, 300);
const debouncedTriggerScraping = debounce(triggerScraping, 300);

document.addEventListener('DOMContentLoaded', debouncedFetchCompanies);
document.getElementById('load-data').addEventListener('click', debouncedFetchCompanies);
document.getElementById('trigger-scraping').addEventListener('click', debouncedTriggerScraping);
