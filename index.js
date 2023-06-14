const core = require('@actions/core')
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const apiUrl = "https://qa-reports.calance.work/allure-api/allure-docker-service";

const loginCredentials = {
    username: process.env.username,
    password: process.env.password
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

        const statusCode = response.status;
        if (statusCode === 200) {
            core.info('Login API status is 200. Success!');
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
                core.setFailed(`Something went wrong in getting projects. Status Code: ${resp.status}`)
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

                if (res.status !== 201) {
                    core.setFailed(`Something went wrong in creating project. Status Code: ${res.status}`)
                }

                // const result = await response.json()
            } else {
                console.log("Project already exists")
            }

            const folderPath = core.getInput('results_path');

            fs.readdir(folderPath, (err, files) => {
                if (err) {
                    console.error('Error reading folder:', err);
                    return;
                }
                const results = []
                files.forEach((file) => {
                    const filePath = path.join(folderPath, file);
                    const extension = filePath.split('.').pop().toLowerCase();
                    if (extension !== 'json' && extension !== 'xml') {
                        return
                    }

                    let encodedData = {}
                    fs.readFile(filePath, 'utf8', async (err, data) => {
                        if (err) {
                            console.error('Error reading file:', err);
                            return;
                        }

                        const buffer = Buffer.from(data, 'utf8');

                        const base64Data = buffer.toString('base64');

                        results.push({
                            content_base64: base64Data,
                            file_name: file,
                        });

                        if (results.length === files.length) {
                            const output = {
                                results: results,
                            };

                            const filesData = JSON.stringify(output)
                            const res = await fetch(`${apiUrl}/send-results?project_id=${project}&force_project_creation=false`, {
                                method: 'POST',
                                body: filesData,
                                headers: { 'Content-Type': 'application/json', 'cookie': finalCookie, 'X-CSRF-TOKEN': csrfAccessToken }
                            });

                            if (res.status !== 200) {
                                core.setFailed(`Something went wrong in sending result. Status Code: ${res.status}`)
                            }

                            const report = await fetch(`${apiUrl}/generate-report?project_id=${project}`, {
                                method: 'GET',
                                headers: { 'Content-Type': 'application/json', 'cookie': finalCookie },
                            });
                            if (report.status !== 200) {
                                core.setFailed(`Something went wrong in generating report. Status Code: ${report.status}`)
                            }
                            const generatedReprot = await report.json()
                            console.log(generatedReprot)
                        }
                    });
                });
            });

        } else {
            core.setFailed(`Login API status is ${statusCode}.Error occurred.`);
        }
    } catch (error) {
        console.error('Error occurred while hitting the API:', error);
    }
}

checkApiStatus().then();
