const LOCAL_STORAGE_DATA = localStorage.getItem("0");
// UTILITY FUNCTIONS
function changePolylineBoldness(polyline, newWeight) {
    polyline.setOptions({ strokeWeight: newWeight });
}
function changePolylineColor(polyline, newColor) {
    polyline.setOptions({ strokeColor: newColor });
}
function changePolylineOpacity(polyline, newOpacity) {
    polyline.setOptions({ strokeOpacity: newOpacity });
}
function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = degreesToRadians_M(lat2 - lat1);
    const dLng = degreesToRadians_M(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(degreesToRadians_M(lat1)) * Math.cos(degreesToRadians_M(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function calculateTotalDistance(coords) {
    let totalDistance = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        const { lat: lat1, lng: lng1 } = coords[i];
        const { lat: lat2, lng: lng2 } = coords[i + 1];
        totalDistance += haversineDistance(lat1, lng1, lat2, lng2);
    }
    return totalDistance;
}
function degreesToRadians_M(degrees) {
    return degrees * (Math.PI / 180);
}
function calculateDistances(points, per) {
    let distances = [];
    let distance = 0;
    for (let i = 0; i < points.length; i += per) {
        if (i + per-1 >= points.length) {
            const from = i;
            const to = points.length-1;
            for(let j = from; j < to ; j++){
                const start = points[j];
                const end = points[j+1];
                let tmp = haversineDistance(start.lat, start.lng, end.lat, end.lng);
                if(tmp<1)   distance += tmp;
            }
        }
        else if (i + per-1 < points.length) {
            const from = i;
            const to = i+per-1;
            for(let j = from; j < to ; j++){
                const start = points[j];
                const end = points[j+1];
                let tmp = haversineDistance(start.lat, start.lng, end.lat, end.lng);
                if(tmp<1)   distance += tmp;
            }

        }
        // console.log(distance)
        distance *= 1000;
        distances.push(distance/per);
        distance = 0;
    }
    return distances;
}
function removeColumns(array, columnsToRemove) {
    return array.map(obj => {
        let newObj = {};
        for (let key in obj) {
            if (!columnsToRemove.includes(key)) {
                newObj[key] = obj[key];
            }
        }
        return newObj;
    });
}
function clean(points){
    for (let i = 0; i < points.length-1; i++) {
        const start = points[i];
        if(start.lat ===0 && start.lng === 0){
            points.splice(i, 1);
            i=i-2;
        }
        const end = points[i+1];
        let tmp = haversineDistance(start.lat, start.lng, end.lat, end.lng);
        if(tmp>=1) {
            points.splice(i+1, 1);
            i--;
        }
    }
}
function roundToDecimalPlaces(num, decimalPlaces) {
    const factor = Math.pow(10, decimalPlaces);
    return Math.round(num * factor) / factor;
}
function averageOnClusters(clusters){
    var C = [];
    var sumLat = 0, sumLng = 0;
    var averageLat = 0, averageLng = 0;
    for(let i = 0; i < clusters.length;i++){
        sumLat=0;
        sumLng=0;
        for(let j = 0; j< clusters[i].length;j++){
            sumLat+=clusters[i][j].lat;
            sumLng+=clusters[i][j].lng;
        }
        averageLat = sumLat/clusters[i].length;
        averageLng = sumLng/clusters[i].length;
        // averageLat = roundToDecimalPlaces(averageLat,7)
        // averageLng = roundToDecimalPlaces(averageLng,7)
        // console.log(averageLat,averageLng)
        C.push({lat:averageLat,lng:averageLng});
    }
    return C;
}
function removeSuccessiveIntegers(arr) {
    const result = [];

    for (let i = 0; i < arr.length; i++) {
        if (i < arr.length - 1 && arr[i] + 1 === arr[i + 1]) {
            result.push(arr[i]);
            i++;
        } else {
            result.push(arr[i]);
        }
    }

    return result;
}
function calculateSlope(point1, point2) {
    const latDiff = point2.lat - point1.lat;
  const lngDiff = point2.lng - point1.lng;

  // Avoid division by zero by checking if lngDiff is 0
  if (lngDiff === 0) {
    return latDiff > 0 ? Infinity : -Infinity; // Vertical line: positive or negative infinite slope
  }

  return latDiff / lngDiff;
  }
  
  function findStablePoints(trajectoriesForTRD, criticalIndex,nextCriticalPointIndex,prevEnd) {
    const stabilityThreshold = 0.15; // Define some slope stability threshold
    let startIndex = criticalIndex, endIndex = criticalIndex;
  
    // Find stable points before the critical point
    for (let i = criticalIndex - 3; i > (criticalIndex+prevEnd)/2 ; i--) {
      const slopeBeforeBefore = calculateSlope(trajectoriesForTRD[i +3], trajectoriesForTRD[i+2]);
      const slopeBefore = calculateSlope(trajectoriesForTRD[i +2], trajectoriesForTRD[i+1]);
      const slopeCurrent = calculateSlope(trajectoriesForTRD[i+1], trajectoriesForTRD[i]);
    //   console.log(slopeBeforeBefore,slopeBefore,slopeCurrent)

      if (Math.abs(slopeBefore - slopeCurrent) < stabilityThreshold && Math.abs(slopeBeforeBefore - slopeBefore) < stabilityThreshold) {
        startIndex = i;
        break;
      } else {
        startIndex=i;
      }
    }
  
    // Find stable points after the critical point
    for (let i = criticalIndex + 3; i < (criticalIndex+nextCriticalPointIndex)/2; i++) {
      const slopeCurrent = calculateSlope(trajectoriesForTRD[i - 1], trajectoriesForTRD[i]);
      const slopeAfter = calculateSlope(trajectoriesForTRD[i-2], trajectoriesForTRD[i -1]);
      const slopeAfterAfter = calculateSlope(trajectoriesForTRD[i-3], trajectoriesForTRD[i - 2]);
      if (Math.abs(slopeCurrent - slopeAfter) < stabilityThreshold&&Math.abs(slopeAfter - slopeAfterAfter) < stabilityThreshold) {
        endIndex = i;
        break;
      } else {
        endIndex=i;
      }
    }
    // console.log(startIndex,endIndex)
    return { startIndex, endIndex };
  }
  
  function reorganizeClusters(trajectoriesForTRD, clusters, turningClusterIndices, criticalPoints) {
    let newClusters = [];
    let newTurningClusterIndices = [];
    let prevEnd = 0;
  
    for (let i = 0; i < turningClusterIndices.length; i++) {
      var turningClusterIndex = turningClusterIndices[i];
      var criticalPointIndex = 0, nextCriticalPointIndex = 0;
      for(let k = 0;k<trajectoriesForTRD.length;k++){
        if(trajectoriesForTRD[k]===criticalPoints[i]){
            criticalPointIndex = k;
        }
        if(i!=turningClusterIndices.length-1){
            if(trajectoriesForTRD[k]===criticalPoints[i+1]){
                nextCriticalPointIndex = k;
            }
        }
        else{
            nextCriticalPointIndex=trajectoriesForTRD.length-1;
        }
      }
      var turningCluster = clusters[turningClusterIndex];
  
      // Find stable points around the critical point
      var { startIndex, endIndex } = findStablePoints(trajectoriesForTRD, criticalPointIndex,nextCriticalPointIndex,prevEnd);
      console.log(prevEnd,startIndex, endIndex)
      // Create ordinary cluster from previous end to start of new turning cluster
      if (startIndex > prevEnd) {
        let ordinaryCluster = trajectoriesForTRD.slice(prevEnd, startIndex-1);
        console.log(ordinaryCluster)
        if (ordinaryCluster.length > 0){
            newClusters.push(ordinaryCluster);
            newTurningClusterIndices.push(newClusters.length);
        }
      }
  
      // Create the new turning cluster with stable points
      var newTurningCluster = trajectoriesForTRD.slice(startIndex, endIndex);
      console.log(newTurningCluster)
    //   console.log(newClusters.length)
      newClusters.push(newTurningCluster);
      
      prevEnd = endIndex + 1; // Update prevEnd for the next iteration
    }
  
    // Handle the remaining ordinary points after the last turning cluster
    if (prevEnd < trajectoriesForTRD.length) {
      let remainingOrdinaryCluster = trajectoriesForTRD.slice(prevEnd);
      if (remainingOrdinaryCluster.length > 0) newClusters.push(remainingOrdinaryCluster);
    }
    // console.log(newClusters)
    // Update the original arrays
    clusters.length = 0;
    clusters.push(...newClusters);
    turningClusterIndices.length=0;
    turningClusterIndices.push(...newTurningClusterIndices);
}
function TRD_M(trajectoriesForTRD, gamma, delta, theta, sigma, clusters, turningClusterIndices){
    clusters = DBC_M(trajectoriesForTRD, gamma, delta, clusters);
    var C = averageOnClusters(clusters);
    // console.log(C)

    var numOfTurningRegions = 0;
    for (let i = 1; i < C.length-1; i++){
        let firstAngle = Math.atan2(C[i].lat-C[i-1].lat,C[i].lng-C[i-1].lng) * (180/Math.PI);
        let secondAngle = Math.atan2(C[i+1].lat-C[i].lat,C[i+1].lng-C[i].lng) * (180/Math.PI);
        //轉成[0~359]
        if(firstAngle<0)   firstAngle+=360;
        if(secondAngle<0)  secondAngle+=360;
        //把firstAngle反向:
        firstAngle+=180;
        if(firstAngle>=360) firstAngle-=360;

        let upper = firstAngle+(180-theta);
        let lower = firstAngle-(180-theta);
        if(upper==360){
            if((secondAngle>=lower&&secondAngle<360) || (secondAngle==0)){
                numOfTurningRegions++;
                turningClusterIndices.push(i);
            }
        }
        else if(upper>360){
            upper-=360;
            if((secondAngle>=0&&secondAngle<=upper) || (secondAngle>=lower&&secondAngle<360)){
                numOfTurningRegions++;
                turningClusterIndices.push(i);
            }
        }
        else if(lower==0){
            if(secondAngle>=0&&secondAngle<=upper){
                numOfTurningRegions++;
                turningClusterIndices.push(i);
            }
        }
        else if(lower<0){
            lower+=360;
            if((secondAngle>=0&&secondAngle<=upper) || (secondAngle>=lower&&secondAngle<360)){
                numOfTurningRegions++;
                turningClusterIndices.push(i);
            }
        }
        else{
            if(secondAngle>=lower && secondAngle<=upper){
                numOfTurningRegions++;
                turningClusterIndices.push(i);
            }
        }
    }
    for (let i = 0; i < turningClusterIndices.length-1; i++) {
        var tt = 1000*haversineDistance(C[turningClusterIndices[i]].lat, C[turningClusterIndices[i]].lng, C[turningClusterIndices[i+1]].lat, C[turningClusterIndices[i+1]].lng);
        if( tt < sigma){
            turningClusterIndices.splice(i,1);
            // console.log(turningClusterIndices)
            turningClusterLengths--;
            numOfTurningRegions--;
            i--;
        }
    }
    //TRD ends here

    let maxDistance = 0;
    let criticalPoint1 = null;
    let criticalPoint2 = null;
    let criticalPoint1Index = null;
    let criticalPoint2Index = null;
    let indices = [0];

    for (let k = 0; k < turningClusterIndices.length-1; k++) {
        maxDistance=0;
        let cluster1 = clusters[turningClusterIndices[k]];
        let cluster2 = clusters[turningClusterIndices[k+1]];

        for (let i=0;i<cluster1.length;i++) {
            for (let j = 0; j < cluster2.length; j++) {
                let point1 = cluster1[i];
                let point2 = cluster2[j];
                const distance = 1000*haversineDistance(point1.lat, point1.lng, point2.lat, point2.lng);
                if (distance > maxDistance) {
                    maxDistance = distance;
                    criticalPoint1Index = i;
                    criticalPoint2Index=j;
                }
            }
        }
        indices[k] = Math.floor((indices[k]+criticalPoint1Index)/2);
        indices.push(criticalPoint2Index);  
    }
    console.log(indices.length);
    for(let k =0;k<indices.length;k++){
        criticalPoints.push(clusters[turningClusterIndices[k]][indices[k]]);
    }
    // console.log(clusters, turningClusterIndices)

    reorganizeClusters(trajectoriesForTRD, clusters, turningClusterIndices, criticalPoints);
    console.log(clusters, turningClusterIndices)

    return numOfTurningRegions;
}

function DBC_M(trajectoriesForTRD, gamma, delta, clusters){
    var currentCluster = [];

    currentCluster.push(trajectoriesForTRD[0]);
    clusters.push(currentCluster);
    currentCluster = [];
    currentCluster.push(trajectoriesForTRD[1]);
    var accumulatedDistance = 0;
    for(let i = 2; i < trajectoriesForTRD.length; i++){
        const point1 = trajectoriesForTRD[i];
        const point2 = trajectoriesForTRD[i-1];
        const distance = 1000*haversineDistance(point1.lat, point1.lng,point2.lat, point2.lng);
        // console.log(distance);
        if(distance < gamma && accumulatedDistance < delta){
            currentCluster.push(trajectoriesForTRD[i]);
            // accumulatedDistance += distance;
            accumulatedDistance += distance;
        }
        else{
            clusters.push(currentCluster);
            currentCluster = [];
            currentCluster.push(trajectoriesForTRD[i]);
            accumulatedDistance = 0;
        }
    }
    return clusters;
}
function inturningClusterIndices(turningClusterIndices,index){
    for(let i =0;i<turningClusterIndices.length;i++){
        if(index === turningClusterIndices[i]){
            return true;
        }
    }
    return false;
}
////////////////////////////////////////////////////////
/***************/
/* START POINT */ 
/***************/ 
let criticalPoints = [];
let criticalPointsIndices = [];
let map2;
// localStorage.setItem("status", "true");
// let tmp = localStorage.getItem("0");
let tmp = JSON.parse(LOCAL_STORAGE_DATA);
const recordClicked = (parseInt(tmp[0],10)+1).toString();

let jsonString = localStorage.getItem(recordClicked);
// localStorage.removeItem("0");
const trajectories = JSON.parse(jsonString);
trajectories.forEach(element => {
    if(element.gps){
        let [lat, lng] = element.gps.split(',');
        element.lat = parseFloat(lat);
        element.lng = parseFloat(lng);
    }
});
const onlyLatAndLng = removeColumns(trajectories, ["dt","gps"]);
console.log(onlyLatAndLng.length);
clean(onlyLatAndLng);
console.log(onlyLatAndLng.length);

const middleIndex = Math.floor(trajectories.length / 2);
const trajectoriesForTRD = onlyLatAndLng.slice();
const gamma = 2, delta = 10, theta = 61, sigma = 4.5;
var clusters = [], turningClusterIndices = [], turningClusters = [],turningClusterLengths = [], numOfTurningRegions = TRD_M(trajectoriesForTRD, gamma, delta, theta, sigma, clusters, turningClusterIndices);
var straightlineLengths = [], straightLinePointNum = [];
var labelsForChart2 = [];
var start = 0, dis = 0, points = 0, label = 0;

turningClusterIndices.forEach((element) =>{
    if(start===element){
        start++;
        return;
    }
    else{
        dis = 0; points=0;
        for(let i  = start;i<element;i++){
            let j,tmp;
            for (j = 0; j < clusters[i].length-1; j += 1) {
                tmp = haversineDistance(clusters[i][j].lat, clusters[i][j].lng, clusters[i][j+1].lat, clusters[i][j+1].lng);
                dis += tmp;
            }
            // if(i+1<clusters.length-1){
            //     tmp = haversineDistance(clusters[i][j].lat, clusters[i][j].lng, clusters[i+1][0].lat, clusters[i+1][0].lng);
            //     dis+=tmp;
            // }
            points+=clusters[i].length;
        }
        straightlineLengths.push(1000*dis);
        // console.log(element)
        straightLinePointNum.push(points);
        label++;
        labelsForChart2.push(`${label}`);
        start = element+1;
    }
});
points=0, dis=0;
for(let i  = start;i<clusters.length;i++){
    for (let j = 0; j < clusters[i].length-1; j += 1) {
        let tmp = haversineDistance(clusters[i][j].lat, clusters[i][j].lng, clusters[i][j+1].lat, clusters[i][j+1].lng);
        dis+=tmp;
    }
    points+=clusters[i].length;
}
straightlineLengths.push(1000*dis);
straightLinePointNum.push(points);
label++;
labelsForChart2.push(`${label}`);


// label++;
var dataForChart2 = [];

for(let i =0 ;i<straightlineLengths.length;i++){
    dataForChart2.push(straightlineLengths[i]/straightLinePointNum[i]);
}
// labelsForChart2.push(`${label}`);
////
for(let i =0;i< turningClusterIndices.length;i++){
    turningClusters.push(clusters[turningClusterIndices[i]]);
}
//
// //最大的地圖:
async function initMap(){
    let map;
    const { Map } = await google.maps.importLibrary("maps");
    map = new Map(document.getElementById("map"), {
        zoom: 19,
        center: onlyLatAndLng[middleIndex],
        mapTypeId: "terrain",
    });
    const route = new google.maps.Polyline({
        path: onlyLatAndLng,
        geodesic: true,
        strokeColor: "red",
        strokeOpacity: 1.0,
        strokeWeight: 2.5,
    });
    route.setMap(map);
}
// ///////////////////////////////////////////////////////////////onlyLatAndLng是清完的座標: (lat, lng)
// //////////////////////
// 畫chart1:
function initChart1(per){
    let defaultBackgroundColor = Array(straightlineLengths.length).fill('pink');

    const distances = calculateDistances(onlyLatAndLng,per);    //每500點聚集為一組並計算每500點所涵蓋的距離，形成一個個距離值，用陣列distances儲存
    // console.log(distances)
    const ctx1 = document.getElementById("myChart1-small");
    const ctx2 = document.getElementById("myChart1");
    const labels = distances.map((_, index) => `${index * per + 1}~${ (index + 1) * per}`);
    const data1 = {
        labels: labels,
        datasets: [{
            label: "Avg. speed per "+ per + " GPS points         Total "+ onlyLatAndLng.length + " points",
            data: distances,
            fill: false,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: defaultBackgroundColor,
            tension: 0.1,
            barThickness: 7,
        }]
    };
    const data2 = {
        labels: labels,
        datasets: [{
            label: "Avg. speed per "+ per + " GPS points         Total "+ onlyLatAndLng.length + " points",
            data: distances,
            fill: false,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: defaultBackgroundColor,
            tension: 0.1,
            barThickness: 7,
        }]
    };
    new Chart(ctx1, {
        type: 'bar',
        data: data1,
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value, index, values) {
                            return value + ' m/s';
                        },
                    }
                },
            },
        }
    });
    new Chart(ctx2, {
        type: 'bar',
        data: data2,
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value, index, values) {
                            return value + ' m/s';
                        },
                        font: {
                            size: 16
                        }
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 16
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        font: {
                            size: 16
                        }
                    },
                
                }
            },
            onClick: function(event, chartElement) {
                if(chartElement.length){
                    const element = chartElement[0];
                    chartElement.pop();
                    const index = element.index;
                    let currentColor = routes1[index].strokeColor;
                    // #FFC0CB is pink
                    if(currentColor==="pink"){
                        changePolylineColor(routes1[index],"red");
                        changePolylineBoldness(routes1[index], 2.5)
                    }
                    else{
                        changePolylineColor(routes1[index],"pink");
                        changePolylineBoldness(routes1[index], 1.5);
                    }
                }
            
            }
        }
    });
}
// 畫chart2:
function initChart2(){
    let defaultBackgroundColor = Array(straightlineLengths.length).fill('pink');
    // console.log(turningClusterLengths)
    const ctx1 = document.getElementById("myChart2-small");
    const ctx2 = document.getElementById("myChart2");

    const data1 = {
        labels: labelsForChart2,
        datasets: [{
            label: "Avg. speed within each straight line",
            data: dataForChart2,
            fill: false,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: defaultBackgroundColor,
            tension: 0.1,
            barThickness: 8,
        }]
    };
    const data2 = {
        labels: labelsForChart2,
        datasets: [{
            label: "Avg. speed within each straight line",
            data: dataForChart2,
            fill: false,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: defaultBackgroundColor,
            tension: 0.1,
            barThickness: 8,
        }]
    };
    var myChart21 = new Chart(ctx1, {
        type: 'bar',
        data: data1,
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value, index, values) {
                            return value + ' m/s';
                        },
                    }
                },
            },
        }
    });
    var myChart22 = new Chart(ctx2, {
        type: 'bar',
        data: data2,
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value, index, values) {
                            return value + ' m/s';
                        },
                        font: {
                            size: 16
                        }
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 16
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        font: {
                            size: 16
                        }
                    },
                
                }
            },
        
            onClick: function(event, chartElement) {
                if(chartElement.length){
                    const element = chartElement[0];
                    chartElement.pop();
                    const index = element.index;

                    const dataset = this.data.datasets[0];
                    const currentColor = dataset.backgroundColor[index];
                    if (currentColor === "pink") {
                        dataset.backgroundColor[index] = "orange"; // Change to orange
                    } else {
                        dataset.backgroundColor[index] = "pink"; // Change back to pink
                    }

                    let strt;
                    if(index==0)    strt = 0;
                    else{
                        let count = 0, i =1;
                        for(i = 1;i<turningClusterIndices.length;i++){
                            if(turningClusterIndices[i]-1 != turningClusterIndices[i-1]){
                                count++;
                                if(count == index)  break;
                            }
                        }
                        // i--;
                        strt = index+i;
                    }
                    // if(index==turningClusterIndices.length) ed=clusters.length;
                    // else    ed = turningClusterIndices[index];
                    for(let i = strt;i<=strt;i++){
                        let currentColor = routes2[i].strokeColor;
                        // #FFC0CB is pink
                        if(currentColor==="pink"){
                            changePolylineColor(routes2[i],"orange");
                            changePolylineBoldness(routes2[i], 2.5)
                        }
                        else{
                            changePolylineColor(routes2[i],"pink");
                            changePolylineBoldness(routes2[i], 1.5)
                        }

                    }
                }
            }
        
        }
    });
}

async function initMapinModal1(per){
    await drawPolylineSegments1(per);
}
let routes1 = [];
async function drawPolylineSegments1(per){
    let map;
    const { Map } = await google.maps.importLibrary("maps");
    map = new Map(document.getElementById("map-in-modal1"), {
        zoom: 18,
        center: onlyLatAndLng[middleIndex],
        mapTypeId: "terrain",
    });
    const infoWindow = new google.maps.InfoWindow();
    const defaultStyle = {
        strokeColor: 'pink',
        strokeOpacity: 1,
        strokeWeight: 1.5
    };
    const highlightStyle = {
        strokeColor: 'orange',
        strokeOpacity: 1.0,
        strokeWeight: 2.5
    };
    let segments = [];
    let currentSegment = [];
    onlyLatAndLng.forEach(function(coord, index){
        currentSegment.push(coord);
        if (currentSegment.length === per || index === onlyLatAndLng.length - 1) {
            segments.push(currentSegment);
            currentSegment = currentSegment.slice(-1);
        }
    });
    segments.forEach(function(segmentCoords) {
        const route = new google.maps.Polyline({
            path: segmentCoords,
            geodesic: true,
            strokeColor: 'pink',
            strokeOpacity: 1.0,
            strokeWeight: 1.5
        });
        route.setMap(map);
        routes1.push(route);
    });
}
async function initMapinModal2(){
    await drawPolylineSegments2();
}

let routes2 = [];
async function drawPolylineSegments2(){
    let map, last = clusters[0][0];
    const { Map } = await google.maps.importLibrary("maps");
    map = new Map(document.getElementById("map-in-modal2"), {
        zoom: 18,
        center: onlyLatAndLng[middleIndex],
        mapTypeId: "terrain",
    });
    const {AdvancedMarkerElement} = await google.maps.importLibrary("marker");
    criticalPoints.forEach(function(point) {
        const dotIcon = {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 2,
            fillColor: '#3F00FF',
            fillOpacity: 1,
            strokeColor: '#3F00FF',
            strokeOpacity: 1,
            strokeWeight: 1
        };
        const marker = new google.maps.Marker({
            position: point,
            map: map, // Assuming 'map' is the Google Maps object you created earlier
            title: 'Critical Point',
            icon: dotIcon,
        });
    });
    const infoWindow = new google.maps.InfoWindow();

    const defaultStyle = {
        strokeColor: 'pink',
        strokeOpacity: 1,
        strokeWeight: 1.5
    };
    const highlightStyle = {
        strokeColor: 'orange',
        strokeOpacity: 1.0,
        strokeWeight: 2.5
    };

    let accumulatedCoords = []; // Accumulator for non-turning clusters
    // let count = 0;
    clusters.forEach(function(segmentCoords, index) {
        segmentCoords.unshift(last);
    
        if (inturningClusterIndices(turningClusterIndices, index)) {
            // count++;
            if (accumulatedCoords.length > 0) {
                let accumulatedRoute = new google.maps.Polyline({
                    path: accumulatedCoords,
                    geodesic: true,
                    strokeColor: 'pink',
                    strokeOpacity: 1,
                    strokeWeight: 1.5,
                    data: [accumulatedCoords.length,roundToDecimalPlaces(1000*calculateTotalDistance(accumulatedCoords),3)]
                });
                let isHighlighted = false;

                // // Event listener for click
                google.maps.event.addListener(accumulatedRoute, 'click', function(event) {
                    if (isHighlighted) {
                        // Revert to default style and close the info window
                        accumulatedRoute.setOptions(defaultStyle);
                        infoWindow.close();
                        
                        setTimeout(() => {
                            // myChart22.data.datasets.backgroundColor = 'rgba(75, 192, 192, 0.7)';
                            // myChart22.update();  // Update the chart
                            let chart = Chart.getChart("myChart2");
                    // chart.destroy();
                            chart.data.datasets[0].backgroundColor[(index-1)/2] = 'pink';
                            chart.update();
                        }, 0);
                
                        isHighlighted = false;
                    } else {
                        // Apply highlight style and open the info window
                        accumulatedRoute.setOptions(highlightStyle);
                        infoWindow.setContent(`<div><strong># of points:</strong><br>${accumulatedRoute.data[0]}<br><strong>Straight line length:</strong><br>${accumulatedRoute.data[1]}m</div>`); 
                        infoWindow.setPosition(event.latLng); 
                        infoWindow.open(map);
                
                        setTimeout(() => {
                            // myChart21.data.datasets.backgroundColor = 'rgba(255, 255, 132, 0.7)';
                            // myChart21.update();  // Update the chart
                            let chart = Chart.getChart("myChart2");
                            // chart.destroy();
                            chart.data.datasets[0].backgroundColor[(index-1)/2] = 'orange';
                            chart.update();
                        }, 0);

                
                        isHighlighted = true;
                    }
                });
                
                accumulatedRoute.setMap(map);
                routes2.push(accumulatedRoute);
                accumulatedCoords = [];
            }

            let route = new google.maps.Polyline({
                path: segmentCoords,
                geodesic: true,
                strokeColor: 'red',
                strokeOpacity: 1,
                strokeWeight: 2.5,
            });
            route.setMap(map);
            routes2.push(route);
            last = segmentCoords[segmentCoords.length - 1];
        } else {
            accumulatedCoords = accumulatedCoords.concat(segmentCoords);
            last = segmentCoords[segmentCoords.length - 1];
        }
    });

    if (accumulatedCoords.length > 0) {
        // count++;
        let accumulatedRoute = new google.maps.Polyline({
            path: accumulatedCoords,
            geodesic: true,
            strokeColor: 'pink',
            strokeOpacity: 1,
            strokeWeight: 1.5,
            data: [accumulatedCoords.length,roundToDecimalPlaces(1000*calculateTotalDistance(accumulatedCoords),3)]
        });
        let isHighlighted = false;

        // Event listener for click
        google.maps.event.addListener(accumulatedRoute, 'click', function(event) {
            if (isHighlighted) {
                // Revert to default style and close the info window
                accumulatedRoute.setOptions(defaultStyle);
                infoWindow.close();
                
                setTimeout(() => {
                    let chart = Chart.getChart("myChart2");
                    chart.data.datasets[0].backgroundColor[straightlineLengths.length-1] = 'pink';
                    chart.update();
                }, 0);
        
                isHighlighted = false;
            } else {
                // Apply highlight style and open the info window
                accumulatedRoute.setOptions(highlightStyle);
                infoWindow.setContent(`<div><strong># of points:</strong><br>${accumulatedRoute.data[0]}<br><strong>Straight line length:</strong><br>${accumulatedRoute.data[1]}m</div>`); 
                infoWindow.setPosition(event.latLng); 
                infoWindow.open(map);
        
                setTimeout(() => {
                    let chart = Chart.getChart("myChart2");
                    chart.data.datasets[0].backgroundColor[straightlineLengths.length-1] = 'orange';
                    chart.update();
                }, 0);

        
                isHighlighted = true;
            }
        });
        accumulatedRoute.setMap(map);
        routes2.push(accumulatedRoute);
    }
}



$(document).ready(function(){
initChart1(200);   //modal的小圖表和modal進去之後的大圖表
initChart2();
// initChart3();
initMapinModal1(200);   //進入modal後的地圖，500代表是以每500點為區段繪製(方便改變軌跡顏色)
initMapinModal2();
// initMapinModal3();
});