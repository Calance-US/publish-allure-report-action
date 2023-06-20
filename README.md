# :black_nib: Project Title

[![GitHub Super-Linter](https://github.com/Calance-US/public-repository-template/workflows/Lint%20Code%20Base/badge.svg)](https://github.com/marketplace/actions/super-linter)

This action allows you to generate and publish Allure reports for your GitHub Actions workflows. Allure is a flexible, lightweight test report tool that provides clear and concise visual representations of test execution results.

## :baby: Requirements and Depedencies
- Must have a folder that includes test results.
- The result files should either be in JSON or XML format.
- Must have admin credentials for the QA reporting tool.

## :tada: Running the project
To use this perticular action in your workflow, just update the path of this action in your uses section with the latest updated version.

      Calance-US/publish-allure-report-action@v1.0.0

There are certain input variables you have to pass while calling this action:
- `project_name`: This refers to the name of the project that goes in allure testing tool. If not passed it defaults to the repository name.
- `results_path`: Path of the test results directory. If not passed it defaults to `test-results`.
- `api_url`: This refers to the URL for the Allure QA tool.
- `username`: Username for the QA tool. Should have admin access.
- `password`: Password for the QA tool. Should have admin access.

Your report will be generated and updated in the allure tool. You can also check the report generated in the output of the action.

## :computer: Debugging the code
NA

## :flashlight: Testing
NA

## :information_desk_person: Contributors

**Project Manager/s:**
- [Arpit Goyal](https://github.com/agoyalcalance)
- [Yash Pal Mittal](https://github.com/ypmittal)

**Developer/s:**
- [Ritik Mittal](https://github.com/Ritik232)
