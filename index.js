const core = require('@actions/core')
const fs = require('fs/promises')
const path = require('path')
const fetch = require('node-fetch')
const setCookieParser = require('set-cookie-parser')

const apiUrl = core.getInput('api_url')
const loginCredentials = {
  username: core.getInput('username'),
  password: core.getInput('password')
}
const project = core.getInput('project_name')

async function publishReport () {
  try {
    // login feature
    const response = await fetch(`${apiUrl}/login`, {
      method: 'POST',
      body: JSON.stringify(loginCredentials),
      headers: { 'Content-Type': 'application/json' }
    })
    const message = await response.json()
    if (response.status !== 200) {
      throw new Error(`Login failed! ${JSON.stringify(message, null, 2)}`)
    }
    const cookie = response.headers.raw()['set-cookie']
    const cookies = setCookieParser.parse(cookie, {
      decodeValues: true,
      map: true,
      silent: false
    })
    const finalCookie = [
      `access_token_cookie=${cookies.access_token_cookie.value}`,
      `csrf_access_token=${cookies.csrf_access_token.value}`,
      `refresh_token_cookie=${cookies.refresh_token_cookie.value}`,
      `csrf_refresh_token=${cookies.csrf_refresh_token.value}`
    ].join('; ')
    const csrfAccessToken = cookies.csrf_access_token.value
    // get projects
    const resp = await fetch(`${apiUrl}/projects`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', cookie: finalCookie }
    })
    const data = await resp.json()

    if (resp.status !== 200) {
      throw new Error(
        `Failed to get projects. ${JSON.stringify(data, null, 2)}`
      )
    }

    const projects = data.data.projects

    const keys = Object.keys(projects)

    const exists = keys.includes(project)

    if (exists === false) {
      // create project
      const res = await fetch(`${apiUrl}/projects`, {
        method: 'POST',
        body: JSON.stringify({
          id: project
        }),
        headers: {
          'Content-Type': 'application/json',
          cookie: finalCookie,
          'X-CSRF-TOKEN': csrfAccessToken
        }
      })

      const newProject = await res.json()
      if (res.status !== 201) {
        throw new Error(
          `Failed to create project. ${JSON.stringify(newProject, null, 2)}`
        )
      }
    }

    const folderPath = core.getInput('results_path')
    async function readdir () {
      const file = await fs.readdir(folderPath)
      return file
    }
    const files = await readdir()
    const result = []
    files.forEach((file) => {
      const filePath = path.join(folderPath, file)
      const extension = filePath.split('.').pop().toLowerCase()
      if (extension === 'json' || extension === 'xml') {
        result.push(filePath)
      }
    })
    let encodedData = []
    for (let i = 0; i < result.length; i++) {
      const filePath = result[i]
      const results = []
      async function readfile () {
        const fileData = await fs.readFile(filePath)
        const buffer = Buffer.from(fileData, 'utf8')
        const base64Data = buffer.toString('base64')
        results.push({
          content_base64: base64Data,
          file_name: files[i]
        })
        return results
      }
      const data = await readfile()
      encodedData = [...encodedData, ...data]
    }
    const object = {
      results: encodedData
    }

    const filesData = JSON.stringify(object)
    const res = await fetch(
      `${apiUrl}/send-results?project_id=${project}&force_project_creation=false`,
      {
        method: 'POST',
        body: filesData,
        headers: {
          'Content-Type': 'application/json',
          cookie: finalCookie,
          'X-CSRF-TOKEN': csrfAccessToken
        }
      }
    )
    const resultsApiData = await res.json()
    if (res.status !== 200) {
      throw new Error(
        `Failed to send results. ${JSON.stringify(resultsApiData, null, 2)}`
      )
    }
    const report = await fetch(
      `${apiUrl}/generate-report?project_id=${project}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', cookie: finalCookie }
      }
    )

    const generatedReprot = await report.json()
    if (report.status !== 200) {
      throw new Error(
        `Failed to generate report. ${JSON.stringify(generatedReprot, null, 2)}`
      )
    }

    core.info(`Published report. API respoonse: ${JSON.stringify(generatedReprot, null, 2)}`)
  } catch (error) {
    core.setFailed(`Error occurred while hitting the API: ${error.message}`)
  }
}

publishReport()
