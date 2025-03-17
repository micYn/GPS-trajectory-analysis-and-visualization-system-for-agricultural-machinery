let fetchedtotal=0;
let filledtotal=0;
let compressedtotal=0;
let compressedrepairtotal=0;



var revealed = [];
const recordSize = 12;
const workRecord = [
    ["1", "2023-02-21T10:50:00", "2023-02-21T11:42:53", "0:52", "3122","-","-","-","-"],
    ["2", "2023-02-20T14:06:08", "2023-02-20T15:15:00", "1:08", "4061","-","-","-","-"],
    ["3", "2023-01-31T12:46:06", "2023-01-31T14:28:31", "1:42", "6039","-","-","-","-"],
    ["4", "2022-09-05T13:30:00", "2022-09-05T17:14:59", "3:44", "7241","-","-","-","-"],
    ["5", "2023-02-23T09:00:00", "2023-02-23T10:30:00", "1:30", "5309","-","-","-","-"],
    ["6", "2022-09-08T14:37:29", "2022-09-08T16:47:38", "2:10", "4192","-","-","-","-"],
    ["7", "2023-05-04T17:05:00", "2023-05-04T18:10:00", "1:05", "3868","-","-","-","-"],
    ["8", "2023-05-11T12:45:00", "2023-05-11T13:30:00", "0:45", "2651","-","-","-","-"],
    ["9", "2023-06-22T10:41:29", "2023-06-22T11:39:35", "0:58", "3427","-","-","-","-"],
    ["10", "2023-04-13T09:44:00", "2023-04-13T10:48:57", "1:04", "3762","-","-","-","-"],
    ["11", "2023-04-13T08:59:00", "2023-04-13T09:37:00", "0:38", "2201","-","-","-","-"],
    ["12", "2023-04-19T12:54:00", "2023-04-19T14:31:00", "1:37", "5156","-","-","-","-"],
];
function initDataTable() {
    $('#work-record').DataTable({
        pageLength: 15,
        lengthMenu: [5, 10, 15, 20, 25]
    });

}
function populateTable(dataArray) {
    const table = document.getElementById('work-record');
    const tbody = table.querySelector('tbody');

    dataArray.forEach((rowArray) => {
        const row = document.createElement('tr');

        rowArray.forEach((cellData) => {
            const cell = document.createElement('td');

            cell.textContent = cellData;

            row.appendChild(cell);
        });

        tbody.appendChild(row);
    });
}
function revealRow(tableId, rowNumber) {
    const table = document.getElementById(tableId);
    
    const rows = table.querySelectorAll('tr');

    if (rowNumber >= 0 && rowNumber < rows.length) {
        rows[rowNumber].style.display = 'table-row';
    }

    revealed.push(rowNumber);
}
function hideRow(tableId, rowNumber) {
    // rowNumber = rowNumber-1;

    const table = document.getElementById(tableId);

    const rows = table.getElementsByTagName('tr');

    // Ensure rowNumber is within valid range
    if (rowNumber >= 0 && rowNumber < rows.length) {
        rows[rowNumber].style.display = 'none';
    }
    revealed = revealed.filter(item => item !== rowNumber);
}
function averageGps(gps1, gps2) {
    const [lat1, lon1] = gps1.split(',').map(Number);
    const [lat2, lon2] = gps2.split(',').map(Number);
  
    const avgLat = (lat1 + lat2) / 2;
    const avgLon = (lon1 + lon2) / 2;
  
    return `${avgLat.toFixed(7)},${avgLon.toFixed(7)}`;
}
function formatDateWithoutZ(date) {
    return date.toISOString().split('.')[0].replace('Z', '');
}
function interpolateGPS(point1, point2, fraction) {
    const [lat1, lon1] = point1.gps.split(',').map(Number);
    const [lat2, lon2] = point2.gps.split(',').map(Number);

    const latInterpolated = lat1 + (lat2 - lat1) * fraction;
    const lonInterpolated = lon1 + (lon2 - lon1) * fraction;

    const latFormatted = latInterpolated.toFixed(8);
    const lonFormatted = lonInterpolated.toFixed(8);

    return `${latFormatted},${lonFormatted}`;
}
function fillTimeGaps(filledData) {
    const newData = [];
    let missedCount = 0;

    for (let i = 0; i < filledData.length - 1; i++) {
        const currentPoint = filledData[i];
        const nextPoint = filledData[i + 1];

        newData.push(currentPoint);

        const currentTime = Date.parse(currentPoint.dt);
        const nextTime = Date.parse(nextPoint.dt);

        // Calculate time difference in seconds
        const timeDiff = (nextTime - currentTime) / 1000;

        if (timeDiff > 1) {
            missedCount+=(timeDiff-1);
            for (let j = 1; j < timeDiff; j++) {
                const fraction = j / timeDiff;
                const interpolatedTime = formatDateWithoutZ(new Date(currentTime + j * 1000 + 8 * 60 * 60 * 1000));
                const interpolatedGPS = interpolateGPS(currentPoint, nextPoint, fraction);

                newData.push({ dt: interpolatedTime, gps: interpolatedGPS });
                
            }
        }
    }
    
    // Add the last point
    newData.push(filledData[filledData.length - 1]);

    return { newData, missedCount };
}
const authURL = 'https://engpowerapi.azurewebsites.net';
const baseURL = 'https://rstpowerapi.azurewebsites.net';
function fetchFunction(typedValue, sdt, edt, number) {
    const authPayload = {
        "servId": "dtrikhdemo01",
        "acc": typedValue,
        "pw": "nsysuec5020ay112pw"
    };
    const dataPayload = {
        "equId": "nsysuec5020ay112",
        "sdt": sdt,
        "edt": edt,
    };
    return new Promise((resolve, reject) => {
        let result = 2;

        fetch(`${authURL}/Login/Login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(authPayload)
        })
        .then(response => {
            if (response.status === 200) {
                result = 1;
                
                return response.json();
            } else {
                result = 2;
                resolve(result);
            }
        })
        .then(data => {
            return fetch(`${baseURL}/Equ/GetEquRawList`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${data.access_token}` ,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(dataPayload)
            });
        })
        .then(response => {
            if (response.status === 200) {
                return response.json().then(fetchedData => {
                    //remove dup and mal points and interpolate
                    const uniqueGpsPoints = new Set();
                    let removedCount = 0;
                    let zeroGpsCount = 0;
                    let filledData = fetchedData.filter((item, index) => {
                        // console.log(`Index: ${index}, GPS: ${item.gps}`);
                        const [lat, lon] = item.gps.split(',').map(Number);
    
                        if (lat === 0 && lon === 0) {
                            zeroGpsCount++;
                            return false;
                        } else if (!uniqueGpsPoints.has(item.gps)) {
                            uniqueGpsPoints.add(item.gps);
                            return true; // Keep the item as it is if it's unique
                        } else if (uniqueGpsPoints.has(item.gps) && index < fetchedData.length - 1){
                            removedCount++;
                            return false;
                        }
                        else{
                            return true;
                        }
                    });
                    //Add missed points
                    const { newData, missedCount } = fillTimeGaps(filledData);
                    filledData = newData; // Update filledData with new data
                    // console.log(filledData)
                    let missed = missedCount-removedCount-zeroGpsCount;
  
                    // console.log(fetchedData);
                    // console.log(filledData);
                    console.log(fetchedData,filledData);


                    //Tidy data happily into localStorage
                    localStorage.setItem(number, JSON.stringify(filledData));


                    let compressedData = LZString.compress(JSON.stringify(fetchedData));
                    // console.log(compressedData)
                    // const decompressedString = LZString.decompressFromUTF16(compressedData);
                    // console.log(JSON.parse(decompressedString))
                    
                    // console.log();
                    localStorage.setItem(100*number, compressedData);

                    let compressedRepairedData = LZString.compress(JSON.stringify(filledData));
                    const fetchedlength = new TextEncoder().encode(JSON.stringify(fetchedData)).length;
                    const filledlength = new TextEncoder().encode(JSON.stringify(filledData)).length;
                    console.log(number," ", fetchedlength, "   ", filledlength, "   ", compressedData.length, compressedRepairedData.length);
                    fetchedtotal+=fetchedlength; filledtotal+=filledlength; compressedtotal+=compressedData.length;compressedrepairtotal+=compressedRepairedData.length;
                    if(number==12){
                        console.log(fetchedtotal,"  ",filledtotal," ",compressedtotal," ",compressedrepairtotal);
                    }
                    //update dataTable:
                    var table = $('#work-record').DataTable();
                    // var data = table.data().toArray();
                    // var rowData = table.row(number-1).data();
                    table.cell(number-1, 5).data(removedCount).draw();
                    table.cell(number-1, 6).data(missed).draw();
                    table.cell(number-1, 7).data(zeroGpsCount).draw();
                    table.cell(number-1, 8).data(filledData.length).draw();
                    // alert("Done.")
                    resolve(result);
                });
            } 
            else {
                result = 3;
                resolve(result);
            }
        })
        .catch(error => {
            reject(error);
        });

    });
}

async function fetchUtility(typedValue, sdt, edt, number){
    const result = await fetchFunction(typedValue, sdt, edt, number);
    if(number==="1"){
        const submitMsg = document.getElementById("submit-msg");
        //const table = $('#work-record').DataTable();
        if(result===1){
            resetSubmitmsg();
            submitMsg.classList.add('success');
            submitMsg.innerHTML = "Welcome!";
            setTimeout(function() {
                $("#accesskeyModal").modal("hide");
                resetSubmitmsg();
                
            }, 1500);
            // revealRow("work-record", 1);
        }
        else if(result===2){
            resetSubmitmsg();
            submitMsg.classList.add('error');
            submitMsg.innerHTML = "Wrong key";
            setTimeout(resetSubmitmsg, 1500);
        }
        else{
            resetSubmitmsg();
            submitMsg.classList.add('error');
            submitMsg.innerHTML = "Server error";
            setTimeout(resetSubmitmsg, 1500);
        }
    }
    else{
        if(result===1){
            // let therow = table.row(Number(number));
            // therow.visible(!therow.visible());
            // revealRow("work-record", Number(number));
        }
    }
    return result;
}
function resetSubmitmsg(){
    const submitMsg = document.getElementById("submit-msg");
    let classList = submitMsg.classList;
    while (classList.length > 0) {
        classList.remove(classList.item(0));
    }
    submitMsg.innerHTML = "";
}
async function loadTable(records, typedValue) {
    try {
        for (let i = 0; i < records.length; i++) {
            const recordId = 100 * (records[i] + 1);
            const recordKey = recordId.toString();

            if (localStorage.getItem(recordKey) === null) {
                // Wait for fetchFunction to complete
                const result = await fetchFunction(typedValue, workRecord[records[i]][1], workRecord[records[i]][2], (records[i] + 1).toString());

                if (result === 1) {
                    revealRow("work-record", records[i] + 1);

                } else if (result === 2) {
                    throw new Error("Wrong key");
                } else {
                    throw new Error("Server error");
                }
            } else {
                const uniqueGpsPoints = new Set();
                let removedCount = 0;
                let zeroGpsCount = 0;
                let fetchedData = JSON.parse(LZString.decompress(localStorage.getItem(recordKey)));
                // console.log(fetchedData)
                let filledData = fetchedData.filter((item, index) => {
                    // console.log(`Index: ${index}, GPS: ${item.gps}`);
                    const [lat, lon] = item.gps.split(',').map(Number);

                    if (lat === 0 && lon === 0) {
                        zeroGpsCount++;
                        return false;
                    } else if (!uniqueGpsPoints.has(item.gps)) {
                        uniqueGpsPoints.add(item.gps);
                        return true; // Keep the item as it is if it's unique
                    } else if (uniqueGpsPoints.has(item.gps) && index < fetchedData.length - 1){
                        removedCount++;
                        return false;
                    }
                    else{
                        return true;
                    }
                });

                const { newData, missedCount } = fillTimeGaps(filledData);
                filledData = newData; // Update filledData with new data
                let missed = missedCount-removedCount-zeroGpsCount;
                // console.log(filledData);
                console.log(fetchedData,filledData);

                //Tidy data happily into localStorage
                // localStorage.setItem(recordKey, JSON.stringify(filledData));

                //update dataTable:
                var table = $('#work-record').DataTable();
                // var data = table.data().toArray();
                // var rowData = table.row(number-1).data();
                // console.log(records[i])
                table.cell(records[i], 5).data(removedCount).draw();
                table.cell(records[i], 6).data(missed).draw();
                table.cell(records[i], 7).data(zeroGpsCount).draw();
                table.cell(records[i], 8).data(filledData.length).draw();
                revealRow("work-record", records[i] + 1);
            }
        }
        // alert("Done.")
        return 1;
    } catch (error) {
        console.error("Error loading table:", error);
        return 0;
    }
}
// document.getElementById('remove-date-btn').addEventListener('click', function() {
//     // console.log("hihi")
//     document.getElementById('fromDate').value='';
//     document.getElementById('toDate').value='';

// });
document.getElementById('download-button').addEventListener('click', function(event) {
    event.preventDefault(); 

    const typedValue = document.getElementById('識別碼2').value;
    document.getElementById('識別碼2').value = '';
    
    const fromDateValue = document.getElementById("fromDate").value;
    const toDateValue = document.getElementById("toDate").value;
// console.log(typedValue, fromDateValue)
    if(typedValue==""||fromDateValue==""||toDateValue==""){
        alert("Please enter every fields");
        return;
    }
    document.getElementById('fromDate').value='';
    document.getElementById('toDate').value='';


    const fromDate = new Date(fromDateValue);
    const toDate = new Date(toDateValue);

    const resultIndices = [];

    workRecord.forEach((record, index) => {
        const recordDate = new Date(record[1]);

        if (recordDate >= fromDate && recordDate <= toDate) {
            resultIndices.push(index);
        }
    });
    const userConfirmed = confirm(resultIndices.length.toString()+" trajectories are going to be downloaded");
    
    if (userConfirmed) {
        loadTable(resultIndices, typedValue)
        .then()
        .catch(error => alert(error.message));
        
    } else {
        return;
    }
});
$(document).ready(function(){
    // console.log('DOM content loaded');
    if(localStorage.getItem("status") === null){
        $('#accesskeyModal').modal('show');

        populateTable(workRecord);      // making a table element for work records
        initDataTable(); // making this table a dataTable

        for(let i = 1;i<=recordSize;i++){
            hideRow('work-record',i);
        }

        $('#submitButton').click(function(event) {
            event.preventDefault(); 

            const userInputField = document.getElementById("識別碼");
            const typedValue = userInputField.value;
            userInputField.value = '';

            const submitMsg = document.getElementById("submit-msg");
            if(typedValue === ''){
                submitMsg.classList.add('error');
                submitMsg.innerHTML = "Please enter all fields";
                setTimeout(resetSubmitmsg, 2000);
            } else{
                submitMsg.classList.add('pending');
                submitMsg.innerHTML = "Pending...";
                let result;
                
                async function firstPass(){
                    result = await fetchUtility(typedValue, workRecord[0][1], workRecord[0][2], "1");   //fetchUtility returns the fetch result(succeed or not)
                    if(result===1){
                        localStorage.setItem("status", "true");
                        localStorage.removeItem("1");
                        localStorage.removeItem("100");
                    }
                }
                firstPass();
            }
        });
    }else{
        populateTable(workRecord);      // making a table element for work records
        initDataTable(); // making this table a dataTable

        for(let i = 1;i<=recordSize;i++){
            hideRow('work-record',i);
        }

        let indices=[];
        for(let i=1;i<=recordSize;i++){
            if(localStorage.getItem(i.toString())!=null){
                indices.push(i-1);
            }
        }
        loadTable(indices,"");
    }
});
// window.addEventListener('beforeunload', function(event) {
//     localStorage.removeItem('status');
// });