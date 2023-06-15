const core = require('@actions/core')
const fs = require('fs/promises');
const path = require('path');
const fetch = require('node-fetch');

const apiUrl = "https://qa-reports.calance.work/allure-api/allure-docker-service";

const loginCredentials = {
    username:  core.getInput('username'),
    password:  core.getInput('password')
};
const project = core.getInput('project_name');

async function checkApiStatus() {
    try {
        // login feature
        const response = await fetch(`${apiUrl}/login`, {
            method: 'POST',
            body: JSON.stringify(loginCredentials),
            headers: { 'Content-Type': 'application/json' }
        });
        const message = await response.json();
        if (response.status !== 200) {
            throw new Error (`Login failed! ${JSON.stringify(message, null, 2)}`)
        }
        const cookies = response.headers.get('set-cookie')
        const lines = cookies.split(";");
        const filteredLines = lines.filter(line => !line.includes("Secure") && !line.includes("HttpOnly"));

        const cookieArray = filteredLines.map(value => {
            let newVal = value.replace(' Path=/,', '')
            newVal = value.replace(' Path=/', '')

            return newVal;
        });
        let finalCookie = cookieArray.join("")
        finalCookie = finalCookie.replaceAll(",", ";")

        //get projects
        const resp = await fetch(`${apiUrl}/projects`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'cookie': finalCookie },
        });
        const data = await resp.json()

        if (resp.status !== 200) {
            throw new Error (`Failed to get projects. ${JSON.stringify(data, null, 2)}`)
        }

        const projects = data.data.projects

        keys = Object.keys(projects)

        const exists = keys.includes(project);
        const match = finalCookie.match(/csrf_access_token=([^;]+)/);
        const csrfAccessToken = match[1];

        if (exists === false) {
            //create project
            const res = await fetch(`${apiUrl}/projects`, {
                method: 'POST',
                body: JSON.stringify({
                    id: project
                }),
                headers: { 'Content-Type': 'application/json', 'cookie': finalCookie, 'X-CSRF-TOKEN': csrfAccessToken }
            });

            const newProject = await res.json()
            if (res.status !== 201) {
                throw new Error (`Failed to create project. ${JSON.stringify(newProject, null, 2)}`)
            }
        }

        const folderPath = core.getInput('results_path');
        async function readdir() {
            const file = await fs.readdir(folderPath)
            return file
        }
        const files = await readdir()
        let result = [];
        files.forEach((file) => {
            const filePath = path.join(folderPath, file);
            const extension = filePath.split('.').pop().toLowerCase();
            if (extension !== 'json' && extension !== 'xml') {
                return
            } else{
                result.push(filePath)
            }
        })
        let encodedData = []
        for (let i = 0; i < result.length; i++) {
            const filePath = result[i];
            let results = [];
            async function readfile() {
                const fileData = await fs.readFile(filePath)
                const buffer = Buffer.from(fileData, 'utf8');
                const base64Data = buffer.toString('base64');
                results.push({
                    content_base64: base64Data,
                    file_name: files[i],
                });
                return results
            }
            const data = await readfile()
            encodedData = [...encodedData, ...data];
        }
        object = {
            results: encodedData
        }

        const filesData = JSON.stringify(object)
        const res = await fetch(`${apiUrl}/send-results?project_id=${project}&force_project_creation=false`, {
            method: 'POST',
            body: filesData,
            headers: { 'Content-Type': 'application/json', 'cookie': finalCookie, 'X-CSRF-TOKEN': csrfAccessToken }
        });
        resultsApiData = await res.json()
        if (res.status !== 200) {
            throw new Error (`Failed to send results. ${JSON.stringify(resultsApiData, null, 2)}`)
        }
        const report = await fetch(`${apiUrl}/generate-report?project_id=${project}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'cookie': finalCookie },
        });

        const generatedReprot = await report.json()
        if (report.status !== 200) {
            throw new Error (`Failed to generate report. ${JSON.stringify(generatedReprot, null, 2)}`)
        } else{
            console.log(generatedReprot)
        }
    } catch (error) {
        core.setFailed(`Error occurred while hitting the API: ${error.message}`);
    }
}

checkApiStatus().then();
