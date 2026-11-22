const BASE_URL = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function buildHeaders(isFormData = false) {
  const headers = {};
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

async function handleResponse(response) {
  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Session expired. Please login again.');
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.message || data?.error || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

function buildQueryString(params) {
  if (!params) return '';
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, value);
    }
  });
  const str = query.toString();
  return str ? `?${str}` : '';
}

export const api = {
  async get(url, params) {
    const response = await fetch(`${BASE_URL}${url}${buildQueryString(params)}`, {
      method: 'GET',
      headers: buildHeaders(),
    });
    return handleResponse(response);
  },

  async post(url, body) {
    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  async put(url, body) {
    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'PUT',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  async delete(url) {
    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    });
    return handleResponse(response);
  },

  async upload(url, formData) {
    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'POST',
      headers: buildHeaders(true),
      body: formData,
    });
    return handleResponse(response);
  },
};
