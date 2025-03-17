// Import the libraries from Google Maps API.
const { Map } = await google.maps.importLibrary("maps");
const { spherical } = await google.maps.importLibrary("geometry");
const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

/*   ++++++ Make Path Function +++++   */

// Create a route from the stored GPS data in localStorage
function createRouteFromLocalStorage(localStorageData) {
    const data = JSON.parse(localStorageData);
    // Check if the data exists
    if (!data) {
        console.error("No GPS data found in localStorage.");
        return [];
    }
    const chosenRoute = (parseInt(data[0], 10) + 1).toString();
    console.log("Chosen route data is number:", chosenRoute);
    let jsonString = localStorage.getItem(chosenRoute);
    // Parse the JSON data
    let praseRoute;
    try {
        praseRoute = JSON.parse(jsonString);
    } catch (e) {
        console.error("Error parsing GPS data:", e);
        return [];
    }
    // Extract the GPS coordinates and convert them into { lat: num, lng: num }
    let route = praseRoute.map(item => {
        const [lat, lng] = item.gps.split(",").map(Number);
        return { lat, lng };
    });

    return route;
}

// Linear interpolation
function interpolateValues(start, end, numInsertions) {
    const step = (end - start) / (numInsertions + 1);
    const interpolatedValues = [];

    for (let i = 1; i <= numInsertions; i++) {
        interpolatedValues.push(start + step * i);
    }

    return interpolatedValues;
}

// Remove outliers of GPS points
function removelatLngObjectListOutliers(latLngObjectList) {
    const getValues = (key) => latLngObjectList.map(item => item[key]);
    const calculateIQR = (values) => {
        values.sort((a, b) => a - b);
        const q1 = values[Math.floor((values.length / 4))];
        const q3 = values[Math.floor((values.length * (3 / 4)))];
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        return { lowerBound, upperBound };
    };

    const latValues = getValues('lat');
    const lngValues = getValues('lng');

    const latIQR = calculateIQR(latValues);
    const lngIQR = calculateIQR(lngValues);

    console.log("Path point number BEFORE remove outlier(s): ", latLngObjectList.length);
    const filteredData = latLngObjectList.filter(item => 
        item.lat >= latIQR.lowerBound && item.lat <= latIQR.upperBound &&
        item.lng >= lngIQR.lowerBound && item.lng <= lngIQR.upperBound
    );
    console.log("Path point number AFTER remove outlier(s): ", filteredData.length);

    return filteredData;
}

// Remove outliers of GPS points and Interpolate
function removeRouteOutliersAndInterpolate(latLngObjectList) {
    const getValues = (key) => latLngObjectList.map(item => item[key]);
    const calculateIQR = (values) => {
        values.sort((a, b) => a - b);
        const q1 = values[Math.floor(values.length / 4)];
        const q3 = values[Math.floor(values.length * (3 / 4))];
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        return { lowerBound, upperBound };
    };

    const latValues = getValues('lat');
    const lngValues = getValues('lng');

    const latIQR = calculateIQR(latValues);
    const lngIQR = calculateIQR(lngValues);

    console.log("Path point number BEFORE remove outlier(s) and interpolation:", latLngObjectList.length);
    
    const filteredData = [];
    for (let i = 0; i < latLngObjectList.length; i++) {
        const item = latLngObjectList[i];
        if (item.lat >= latIQR.lowerBound && item.lat <= latIQR.upperBound &&
            item.lng >= lngIQR.lowerBound && item.lng <= lngIQR.upperBound) {
            filteredData.push(item);
        } else if (filteredData.length > 0 && i + 1 < latLngObjectList.length) {
            // Detect and interpolate for consecutive outliers
            let tempindex = i;
            let nextItem;
            do {
                ++tempindex;
                if (tempindex >= latLngObjectList.length) {
                    break;
                }
                nextItem = latLngObjectList[tempindex];
            } while ( ! (nextItem.lat >= latIQR.lowerBound && nextItem.lat <= latIQR.upperBound &&
                         nextItem.lng >= lngIQR.lowerBound && nextItem.lng <= lngIQR.upperBound));

            if (tempindex >= latLngObjectList.length) {
                break;
            }
            let numContinuousOutlier = tempindex - i;
            console.log("Number of continuous outliers:", numContinuousOutlier);

            const latInterpolations = interpolateValues(filteredData[filteredData.length - 1].lat, nextItem.lat, numContinuousOutlier);
            const lngInterpolations = interpolateValues(filteredData[filteredData.length - 1].lng, nextItem.lng, numContinuousOutlier);

            for (let j = 0; j < numContinuousOutlier; j++) {
                filteredData.push({
                    lat: latInterpolations[j],
                    lng: lngInterpolations[j]
                });
            }
            i = tempindex - 1;
        }
    }

    console.log("Path point number AFTER remove outlier(s) and interpolation:", filteredData.length);

    return filteredData;
}

// Compute two latLng object's distance
function computeTwoLatLngObjectDistance(latLngObject1, latLngObject2) {
    const point1 = new google.maps.LatLng(latLngObject1.lat, latLngObject1.lng);
    const point2 = new google.maps.LatLng(latLngObject2.lat, latLngObject2.lng);
    const distance = google.maps.geometry.spherical.computeDistanceBetween(point1, point2);

    return distance;
}

// Compute two latLng object's distance list
function computeLatLngObjectDistanceList(latLngObjectList) {
    if (latLngObjectList.length < 2) {
        return []; // If there are fewer than 2 points, no distances can be computed.
    }

    const distances = [];
    
    for (let i = 0; i < latLngObjectList.length - 1; i++) {
        distances.push(computeTwoLatLngObjectDistance(latLngObjectList[i], latLngObjectList[i + 1]));
    }

    return distances;
}

/*   +++++ Initalize Google Maps Function +++++   */

// Initialize the main map.
function initMAP(thePath) {
    // Check the status in localStorage
    const status = localStorage.getItem("status");

    if (status !== "true") {
        console.log("Status is not set to true. Initialization aborted.");
        return;
    }

    // Create a new map instance centered at the specified coordinates.
    const mapCenter = findIndexMiddleLatLngObject(thePath);
    MAP = new Map(document.getElementById("map"), {
        center: mapCenter,
        zoom: 20,
        mapId: 'DEMO_MAP_ID',
        mapTypeId: 'satellite'
    });
}

/*   ++++++ Add Object on Google Maps Function +++++   */

// Highlight the points on the map
function highlightGPSPointsOnMap(theMap, thePoints, theTitle = "Dot", theFillColor, theStrokeColor) {
    thePoints.forEach(point => {
        new google.maps.Marker({
            position: point,
            map: theMap,
            title: theTitle,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 3,
                fillColor: theFillColor,
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: theStrokeColor,
            }
        });
    });
}

// Highlight the points on the map use google.maps.marker.AdvancedMarkerElement "pin" marker
function usePinHighlightGPSPointsOnMap(theMap, thePoints, theTitle = "Pin", theScale, theFillColor, theStrokeColor, theGlyphColor) {
    thePoints.forEach(point => {
        const marker = new google.maps.marker.AdvancedMarkerElement({
            position: point,
            map: theMap,
            title: theTitle,
            content: new google.maps.marker.PinElement({
                scale: theScale,
                background: theFillColor,
                borderColor: theStrokeColor,
                glyphColor: theGlyphColor,
            }).element,
      });
    });
}

// Highlight the points on the map use google.maps.marker.AdvancedMarkerElement "dot" marker
function useDotHighlightGPSPointsOnMap(theMap, thePoints, theTitle = "Dot", theFillColor, theStrokeColor) {
    thePoints.forEach(point => {
        const dotSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">
            <circle cx="5" cy="5" r="4" fill="${theFillColor}" stroke="${theStrokeColor}" stroke-width="1"/>
            </svg>
        `;
  
        const dotIcon = new google.maps.marker.AdvancedMarkerElement({
            position: point,
            map: theMap,
            title: theTitle,
            content: new DOMParser().parseFromString(dotSvg, 'image/svg+xml').documentElement
        });
    });
}

// Add dot shape AdvancedMarkerElement on map
function addDotMarkerOnMap(theMap, position, theTitle = "Dot", customStyle = {}) {
    // Create a new dot marker element
    const dotElement = document.createElement('div');
    dotElement.className = 'dot-marker';
  
    // Apply custom styles if provided
    Object.assign(dotElement.style, {
        width: customStyle.width || '12px',
        height: customStyle.height || '12px',
        backgroundColor: customStyle.backgroundColor || 'red',
        border: customStyle.border || 'white',
        boxShadow: customStyle.boxShadow || '0 0 4px rgba(0, 0, 0, 0.3)',
    });

    const advancedMarker = new google.maps.marker.AdvancedMarkerElement({
        position: position,
        content: dotElement,
        map: theMap,
    });
}

// calculate the color(from RED to PURPLE) of speed for the segment
function calculateColorBySpeed(speed) {

    let hue = Math.round(speed * 120);
    if (hue > 270) {
        hue = 270;
    }

    // Saturation and lightness set to 100% and 50% respectively for vivid colors
    return `hsl(${hue}, 100%, 50%)`;
}

// Create a polyline by one segment (Two points: startPoint & endPoint)
function createPolylineSegment(startPoint, endPoint, theColor, theOpacity, theWeight, theMap, theZIndex) {
    return new google.maps.Polyline({
        path: [startPoint, endPoint],
        geodesic: true,
        strokeColor: theColor,
        strokeOpacity: theOpacity,
        strokeWeight: theWeight,
        clickable: false,  // Doesn't intercept clicks
        map: theMap,
        zIndex: theZIndex,
    });
}

// Create a polyline by path (Many points)
function createPolylinePath(thePath, theColor, theOpacity, theWeight, theMap, theZIndex) {
    return new google.maps.Polyline({
        path: thePath,
        geodesic: true,
        strokeColor: theColor,
        strokeOpacity: theOpacity,
        strokeWeight: theWeight,
        map: theMap,
        zIndex: theZIndex,
    });
}

// Set a polyline
function setPolylinePath(thePolyline, thePath, theColor, theOpacity, theWeight) {
    thePolyline.setOptions({
        path: thePath,
        geodesic: true,
        strokeColor: theColor,
        strokeOpacity: theOpacity,
        strokeWeight: theWeight,
    });
}

/*   ++++++ lat Lng Object List Function +++++   */

// find the average point of a latLng object list
function calculateAverageLatLngObject(latLngObjectList) {
    let GPSCoordinate = {lat: -1, lng: -1};

    if (latLngObjectList.length < 1) {
        console.log("Not enough points( < 1 ) to calculate an average latLngObject")
    }

    let latSum = 0;
    let lngSum = 0;
    for (let i = 0; i < latLngObjectList.length; ++i) {
        latSum += latLngObjectList[i].lat;
        lngSum += latLngObjectList[i].lng;
    }

    GPSCoordinate.lat = latSum / latLngObjectList.length;
    GPSCoordinate.lng = lngSum / latLngObjectList.length;

    return GPSCoordinate;
}

// find the index median point of a latLng object list
function findIndexMiddleLatLngObject(latLngObjectList) {
    let GPSCoordinate = {lat: -1, lng: -1};

    if (latLngObjectList.length < 1) {
        console.log("Not enough points( < 1 ) to find an index middle latLngObject")
    }

    let medianIdx = Math.floor(latLngObjectList.length / 2);
    GPSCoordinate.lat = latLngObjectList[medianIdx].lat;
    GPSCoordinate.lng = latLngObjectList[medianIdx].lng;

    return GPSCoordinate;
}

// Find the point that is the total distance midpoint of a latLngObjectList
function findDistanceMiddleLatLngObject(latLngObjectList) {
    let GPSCoordinate = {lat: -1, lng: -1};

    if (latLngObjectList.length < 2) {
        console.log("Not enough points( < 2 ) to find a distance midpoint latLngObject");

        return GPSCoordinate; // Not enough points to calculate a middle point
    }

    // Step 1: Compute the distances between consecutive points
    const distances = computeLatLngObjectDistanceList(latLngObjectList);

    // Step 2: Calculate the total distance
    const totalDistance = distances.reduce((sum, distance) => sum + distance, 0);

    // Step 3: Find the midpoint of the total distance
    let accumulatedDistance = 0;
    const halfTotalDistance = totalDistance / 2;

    for (let i = 0; i < distances.length; i++) {
        accumulatedDistance += distances[i];

        if (accumulatedDistance >= halfTotalDistance) {
            return latLngObjectList[i + 1]; // Return the point where the midpoint is reached
        }
    }

    // In case something went wrong, which shouldn't happen:
    return GPSCoordinate;
}

/*   ++++++ Find KTP(Key Turning Point) Function +++++   */

// if the distance of two points is greater than is number, 
// the later point will be clustered to a new cluster group
const GAMMA = 2;
// cluster group's total distance must less than this number
const DELTA = 3;

// Distance-Based Clustering
function DBC(distanceList) {
    const DBCList = [];
    let clusterGroup = [PATH[0]];
    let accDst = 0;
    for (let i = 0; i < distanceList.length; ++i) {
        // if (distanceList[i] == 0) {  // duplicated points
        //     usePinHighlightGPSPointsOnMap(MAP, [PATH[i+1]], "Duplicated point", 0.3, "red", "black", "black");
        //     // continue;  // skip the duplicated points
        // }
        if (distanceList[i] < GAMMA  &&  accDst < DELTA) {
            clusterGroup.push(PATH[i+1]);
            accDst += distanceList[i];
        } else {
            DBCList.push(clusterGroup);
            // hightlight Distance-Based Clustering
            // if (DBCList.length % 2) {
            //     highlightGPSPointsOnMap(MAP, clusterGroup, "Yellow", "yellow", "yellow");
            // } else {
            //     highlightGPSPointsOnMap(MAP, clusterGroup, "Blue", "blue", "blue");
            // }
            accDst = 0;
            clusterGroup = [];  // clear for a new clustering region
            clusterGroup.push(PATH[i+1]);
        }
    }

    return DBCList;
}

function degreesToRadians(degrees) {
    return degrees * (Math.PI / 180);
}

function radiansToDegrees(radians) {
    return radians * (180 / Math.PI);
}

// calculate the angle of second point of three points
function calculateAngle(pointA, pointB, pointC) {
    const vectorAB = {
        lat: pointB.lat - pointA.lat,
        lng: pointB.lng - pointA.lng
    };

    const vectorBC = {
        lat: pointC.lat - pointB.lat,
        lng: pointC.lng - pointB.lng
    };

    const dotProduct = (vectorAB.lat * vectorBC.lat) + (vectorAB.lng * vectorBC.lng);
    const magnitudeAB = Math.sqrt(vectorAB.lat ** 2 + vectorAB.lng ** 2);
    const magnitudeBC = Math.sqrt(vectorBC.lat ** 2 + vectorBC.lng ** 2);

    const cosTheta = dotProduct / (magnitudeAB * magnitudeBC);
    const angleRadians = Math.acos(cosTheta);
    const angleDegrees = radiansToDegrees(angleRadians);

    return angleDegrees;
}

// Find the two points that form the largest angle at the middle point
function findLargestAnglePoints(latLngObjectList, lessEqualAngle = 181, notThisIndex = -1) {
    let maxAngle = -Infinity;
    let maxPoints = null;

    if (latLngObjectList.length < 3) {
        
        console.log("[ Error ] Calculate angles using less than 3 points! ==so>> return null;");

        return maxPoints;
    }

    if (latLngObjectList.length == 3) {
        maxPoints = {
            pointA: latLngObjectList[0],
            pointB: latLngObjectList[1],  // the middle point where the angle is calculated
            pointC: latLngObjectList[2],
            pointBIndex: 1
        };

        return maxPoints;
    }

    for (let i = 1; i < latLngObjectList.length - 1; i++) {
        const angle = calculateAngle(latLngObjectList[i - 1], latLngObjectList[i], latLngObjectList[i + 1]);

        if (notThisIndex != i  &&  angle > maxAngle  &&  angle <= lessEqualAngle) {
            maxAngle = angle;
            maxPoints = {
                pointA: latLngObjectList[i - 1],
                pointB: latLngObjectList[i],  // the middle point where the angle is calculated
                pointC: latLngObjectList[i + 1],
                pointBIndex: i
            };
        }
    }

    return maxPoints;
}

// if concentration points' angle greater than this number, mark as a turning point
const THETA = 60;
// if two turning points's distance greater than this number, SKIP marking the last one as a turning point
const SIGMA = 4.5;

// Turning Region Detecting
function TRD(DBCList) {
    let turningClusterIndexList = [];
    for (let i = 1; i < DBCList.length - 1; ++i) {
        // const avgPoint = calculateAverageGPSPoint(clusterGroup);  // get average GPS point
        const clusterRepresentativePoint1 = findDistanceMiddleLatLngObject(DBCList[i-1]);  // get middle GPS point1
        const clusterRepresentativePoint2 = findDistanceMiddleLatLngObject(DBCList[i]);  // get middle GPS point2
        const clusterRepresentativePoint3 = findDistanceMiddleLatLngObject(DBCList[i+1]);  // get middle GPS point3
        const degree = calculateAngle(clusterRepresentativePoint1, clusterRepresentativePoint2, clusterRepresentativePoint3);
        const lastTurningClusterIndex = turningClusterIndexList[turningClusterIndexList.length-1];
        if (degree > THETA  &&
            (turningClusterIndexList.length == 0  ||  
            computeTwoLatLngObjectDistance(findDistanceMiddleLatLngObject(DBCList[ lastTurningClusterIndex ]), 
                                           clusterRepresentativePoint2) > SIGMA
            )) {
            turningClusterIndexList.push(i);
            console.log("DBC #%d, TRD #%d, KTP:", i, turningClusterIndexList.length, clusterRepresentativePoint2);  // print TRD point
        }
    }

    return turningClusterIndexList;
}

//                  ///  The first TRD algorithm  ///
/*
const vectorForward = {
    lat: 0,
    lng: 0
};
// get forward vector
for (let i = 0;  i < PATH.length - 1;  ++i) {
    vectorForward.lat += PATH[i+1].lat - PATH[i].lat;
    vectorForward.lng += PATH[i+1].lng - PATH[i].lng;
}
// find close forward vector
let closeForwardVectorPointList = [];
for (let i = 0;  i < PATH.length - 1;  ++i) {
    const vectorCurrent = {
        lat: 0,
        lng: 0
    };
    vectorCurrent.lat = PATH[i+1].lat - PATH[i].lat;
    vectorCurrent.lng = PATH[i+1].lng - PATH[i].lng;

    const dotProduct = (vectorCurrent.lat * vectorForward.lat) + (vectorCurrent.lng * vectorForward.lng);
    const magnitudeAB = Math.sqrt(vectorCurrent.lat ** 2 + vectorCurrent.lng ** 2);
    const magnitudeBC = Math.sqrt(vectorForward.lat ** 2 + vectorForward.lng ** 2);

    const cosTheta = dotProduct / (magnitudeAB * magnitudeBC);
    const angleRadians = Math.acos(cosTheta);
    const angleDegrees = radiansToDegrees(angleRadians);

    if (angleDegrees < 45) {
        closeForwardVectorPointList.push(PATH[i]);
        closeForwardVectorPointList.push(PATH[i+1]);
    }
}

// highlightGPSPoints(closeForwardVectorPointList, "red", "yellow");  // show all TRD points on path (beta)
*/

// find the median number between two numbers
function findMedian(startNum, endNum) {
    return Math.floor((startNum + endNum) / 2);
}

// find the Key Turning Points
function findKTP(DBCList, turningClusterIndexList) {

    let KTPList = [];
    // show two contiguous clusters of the turning cluster
    // for (let i = 0;  i < turningClusterIndexList.length;  ++i) {
    //     highlightGPSPointsOnMap(MAP, DBCList[turningClusterIndexList[i] - 1], "Previous cluster", "black", "Salmon");  ///////////////// before TC
    //     highlightGPSPointsOnMap(MAP, DBCList[turningClusterIndexList[i]], "Turning cluster", "black", "yellow");  ////////////////////// TC
    //     highlightGPSPointsOnMap(MAP, DBCList[turningClusterIndexList[i] + 1], "Next cluster", "black", "SkyBlue");  /////////////// after TC
    // }
    for (let i = 0;  i < turningClusterIndexList.length - 1;  ++i) {
        const turningClusterIndex = turningClusterIndexList[i];
        const nextTurningClusterIndex = turningClusterIndexList[i+1];

        const currTurningRegion = [...DBCList[turningClusterIndex - 1], ...DBCList[turningClusterIndex], ...DBCList[turningClusterIndex + 1]];
        const nextTurningRegion = [...DBCList[nextTurningClusterIndex - 1], ...DBCList[nextTurningClusterIndex], ...DBCList[nextTurningClusterIndex + 1]];

        let twoTRPointDistance = 0;
        let maxDistance = 0;
        let currTRKTP;
        let nextTRKTP;
        for (let j = 0;  j < currTurningRegion.length;  ++j) {
            for (let k = 0;  k < nextTurningRegion.length;  ++k) {
                twoTRPointDistance = computeTwoLatLngObjectDistance(currTurningRegion[j], nextTurningRegion[k]);
                if (twoTRPointDistance > maxDistance) {
                    maxDistance = twoTRPointDistance;
                    currTRKTP = currTurningRegion[j];
                    nextTRKTP = nextTurningRegion[k];
                }
            }
        }
        if ( ! KTPList.length) {
            KTPList.push(currTRKTP);
        } else if (KTPList[KTPList.length - 1] != currTRKTP) {
            let oldKTPIndex = 0;
            let newKTPIndex = 0;
            for (let j = 0;  j < currTurningRegion.length;  ++j) {
                if (KTPList[KTPList.length - 1] == currTurningRegion[j]) {
                    oldKTPIndex = j;
                }
                if (currTRKTP == currTurningRegion[j]) {
                    newKTPIndex = j;
                }
            }
            let oldNewMedianIndex = findMedian(oldKTPIndex, newKTPIndex);
            KTPList.pop();
            KTPList.push(currTurningRegion[oldNewMedianIndex]);
        }
        KTPList.push(nextTRKTP);

        /* use 1st - 3nd largest angle
        // Get the last half of list1
        const lastHalfOfList1 = DBCList[turningClusterIndex - 1].slice(Math.floor(DBCList[turningClusterIndex - 1].length / 2));
        const list2 = DBCList[turningClusterIndex];
        // Get the first half of list3
        const firstHalfOfList3 = DBCList[turningClusterIndex + 1].slice(0, Math.floor(DBCList[turningClusterIndex + 1].length / 2));
    
        // const turningRegion = [...lastHalfOfList1, ...list2, ...firstHalfOfList3];
        const turningRegion = [...DBCList[turningClusterIndex - 1], ...DBCList[turningClusterIndex], ...DBCList[turningClusterIndex + 1]];
        const largestAnglePoints = findLargestAnglePoints(turningRegion);
        const largestAngle = calculateAngle(largestAnglePoints.pointA, largestAnglePoints.pointB, largestAnglePoints.pointC);
        const secondLargestAnglePoints = findLargestAnglePoints(turningRegion, largestAngle, largestAnglePoints.pointBIndex);
        const secondlargestAngle = calculateAngle(secondLargestAnglePoints.pointA, secondLargestAnglePoints.pointB, secondLargestAnglePoints.pointC);
        const thridLargestAnglePoints = findLargestAnglePoints(turningRegion, secondlargestAngle, secondLargestAnglePoints.pointBIndex);
        
        usePinHighlightGPSPointsOnMap(MAP, [largestAnglePoints.pointB], "1st largest angle", 0.3, "red", "white", "white");          // show 1st largest angle
        usePinHighlightGPSPointsOnMap(MAP, [secondLargestAnglePoints.pointB], "2nd largest angle", 0.3, "gold", "white", "white");   // show 2nd largest angle
        usePinHighlightGPSPointsOnMap(MAP, [thridLargestAnglePoints.pointB], "3rd largest angle", 0.3, "blue", "white", "white");    // show 3rd largest angle
    
        // Determine the smaller and larger index
        let startIndex = Math.min(largestAnglePoints.pointBIndex, secondLargestAnglePoints.pointBIndex);
        let endIndex = Math.max(largestAnglePoints.pointBIndex, secondLargestAnglePoints.pointBIndex);
        const largestAnglePointToSecondLargestAnglePoint = turningRegion.slice(startIndex, endIndex + 1);
        
        const distanceMiddlePoint = findDistanceMiddleLatLngObject(largestAnglePointToSecondLargestAnglePoint);
        usePinHighlightGPSPointsOnMap(MAP, [distanceMiddlePoint], "Distance midpoint of 1st & 2nd largest angle", 0.3, "green", "white", "white");  // middle point of largestAnglePointToSecondLargestAnglePoint
        */
    }

    return KTPList;
}

/*   ++++++ Update Function +++++   */

let intervalId; // Variable to store the interval ID
let accumulateDistance = 0;
let TIME = 0;
let isPlaying = false; // To track play/pause state
let updatePerMs = 1000;

// Function to update the current latitude and longitude
function updateLatitudeLongitude() {
    document.getElementById("curLat").textContent = PATH[TIME].lat.toFixed(6);
    document.getElementById("curLng").textContent = PATH[TIME].lng.toFixed(6);
}

// Function to update the accumulated distance
function updateAccumulateDistance() {
    accumulateDistance = PATH_POINTS_DISTANCE_LIST.slice(0, TIME).reduce((sum, current) => sum + current, 0);
    let disPrc = accumulateDistance / PATH_TOTAL_DISTANCE * 100;
    // document.getElementById("accDst").textContent = accumulateDistance.toFixed(2) + "/" + PATH_TOTAL_DISTANCE.toFixed(2) + " meter(s)" + " <" + disPrc.toFixed(2) + "%>";
    document.getElementById("accDst").innerHTML = 
        `<span class='theDarkBlue'>${accumulateDistance.toFixed(2)}</span>/` + 
        `${PATH_TOTAL_DISTANCE.toFixed(2)}</span> meter(s)` + 
        ` <<span class='theDarkBlue'>${disPrc.toFixed(2)}</span>%>`;
}

// Function to convert seconds to hours, minutes, and seconds
function convertSeconds(seconds) {
    let hours = Math.floor(seconds / 3600);
    let minutes = Math.floor((seconds % 3600) / 60);
    let remainingSeconds = seconds % 60;
    let paddedMinutes = String(minutes).padStart(2, '0');
    let paddedSeconds = String(remainingSeconds).padStart(2, '0');

    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
}

// Function to update the accumulated time
function updateAccumulateTime() {
    let timePrc = (TIME / (PATH.length - 1)) * 100;
    // document.getElementById("accTime").textContent = convertSeconds(TIME) + "/" + convertSeconds(PATH.length - 1) + " <" + timePrc.toFixed(2) + "%>";
    document.getElementById("accTime").innerHTML = 
        `<span class='theDarkBlue'>${convertSeconds(TIME)}</span>/` + 
        `${convertSeconds(PATH.length - 1)}</span> ` + 
        `<<span class='theDarkBlue'>${timePrc.toFixed(2)}</span>%>`;
}

// Function to update the completion percentage
function updateCompletionPercentage() {
    let completionPercentage = accumulateDistance * 100 / PATH_TOTAL_DISTANCE;
    document.getElementById("cmpPrc").textContent = completionPercentage.toFixed(2) + " %";
}

// Function to update the average speed
function updateAverageSpeed() {
    let avgSpeed;
    if (TIME > 0) {
        avgSpeed = accumulateDistance / TIME;
    } else {
        avgSpeed = 0;
    }
    const speedColor = calculateColorBySpeed(avgSpeed);
    document.querySelector(".avgSpeed-item").style.backgroundColor = speedColor;
    document.getElementById("avgSpeed").textContent = avgSpeed.toFixed(2) + " m/s";
}

// Function to update the instantaneous speed
function updateInstantaneousSpeed() {
    const secPerPoint = 1;
    let insSpeed;
    if (TIME > 0) {
        insSpeed = PATH_POINTS_DISTANCE_LIST[TIME - 1] / secPerPoint;
    } else {
        insSpeed = 0;
    }
    const speedColor = calculateColorBySpeed(insSpeed);
    document.querySelector(".insSpeed-item").style.backgroundColor = speedColor;
    document.getElementById("insSpeed").textContent = insSpeed.toFixed(2) + " m/s";
}

// Function to update the progress of the color segment
function updateColorSegment() {
    for (let i = 0;  i < TIME;  ++i) {
        COLOR_SEGMENTS[i].setOptions({
            strokeOpacity: 1,
            strokeWeight: 3
        });
    }
    for (let i = TIME;  i < COLOR_SEGMENTS.length;  ++i) {
        COLOR_SEGMENTS[i].setOptions({
            strokeOpacity: 0,
            strokeWeight: 3
        });
    }
    // const greyPath = PATH.slice(TIME - PATH.length);
    // setPolylinePath(GREY_PATH, greyPath, "grey", 0.38, 3);
}

// Function to update the progress of the tea harvester
function updateTeaHarvester() {
    const teaHarvester = TEA_LINE.get("icons");
    if (TIME < PATH.length - 1) {
        TIME++;
    }
    teaHarvester[0].offset = (accumulateDistance * 100 / PATH_TOTAL_DISTANCE) + "%";
    TEA_LINE.set("icons", teaHarvester);
}

// Function to update the progress bar value
function updateProgressBarValue() {
    document.getElementById("progressBar").value = TIME;
    const progressBar = document.getElementById('progressBar');
    const value = TIME / (PATH.length - 1) * 100;
    progressBar.style.background = `linear-gradient(to right, 
        #2020ff, #ddffff ${value}%, 
        #ccc ${value}%, #ccc 100%)`;
}

// Function to update all the UI components
function updateAll() {
    updateLatitudeLongitude();
    updateAccumulateDistance();
    updateAccumulateTime();
    // updateCompletionPercentage();
    updateAverageSpeed();
    updateInstantaneousSpeed();
    updateColorSegment();
    updateTeaHarvester();
    updateProgressBarValue();
}

/*   ++++++ Animation Function +++++   */

// Function to play or pause the progress
function togglePlayPause() {
    const playPauseButton = document.getElementById("playPauseButton");

    if (isPlaying) {
        // Pause the progress
        clearInterval(intervalId);
        playPauseButton.textContent = "l>"; // Set button to "play"
    } else {
        // Start or resume the progress
        intervalId = setInterval(() => {
            updateAll();
        }, updatePerMs);
        playPauseButton.textContent = "l l"; // Set button to "pause"
    }
    isPlaying = !isPlaying;
}

// Function to handle the progress bar dragging
function handleProgressBarDrag(event) {
    const progressBar = document.getElementById("progressBar");
    TIME = parseInt(progressBar.value); // Update TIME based on the progress bar value
    updateAll(); // Update the progress display
}

// Pause the progress while dragging the progress bar
function handleProgressBarMouseDown() {
    if (isPlaying) {
        clearInterval(intervalId); // Pause the interval
    }
}

function handleProgressBarMouseUp() {
    if (isPlaying) {
        // Resume the interval after dragging
        intervalId = setInterval(() => {
            updateAll();
        }, updatePerMs);
    }
}

// Function to handle replay speed change
function changeReplaySpeed() {
    const newSpeed = parseFloat(document.getElementById("replaySpeed").value); // Parse new speed as float
    updatePerMs = Math.floor(1000 / newSpeed); // Update global replay speed
    if (isPlaying) {
        // Restart the interval with the new speed if the progress is playing
        clearInterval(intervalId);
        intervalId = setInterval(() => {
            updateAll();
        }, updatePerMs);
    }
}

// Function to find the closest point on the polyline to the click event
function findClosestPointOnPath(latLng) {
    let closestIndex = 0;
    let closestDistance = Infinity;

    for (let i = 0; i < PATH.length; i++) {
        const point = new google.maps.LatLng(PATH[i].lat, PATH[i].lng);
        const distance = google.maps.geometry.spherical.computeDistanceBetween(latLng, point);

        if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = i;
        }
    }

    return closestIndex;
}

// Function to handle polyline click
function handlePolylineClick(event) {
    const clickedLatLng = event.latLng; // LatLng of the clicked point
    console.log("You click on", clickedLatLng);
    const closestIndex = findClosestPointOnPath(clickedLatLng); // Find the closest point on the path

    // Update TIME and UI
    TIME = closestIndex;
    updateAll(); // Update all the progress display to this point
}



/*    ***  HERE YOU GO  ***  HERE YOU GO  ***  HERE YOU GO  ***  HERE YOU GO  ***  HERE YOU GO  ***    */

/* ///// To do list /////
show the time info when hover the progress bar & map
replay when reach the ending
google maps 測距離

2.1工作軌跡：游標停留的軌跡處，顯示速率、時間點、行數、長度和行進耗時、停駐點次數和停留時間、此軌跡占全工作軌跡長度%數等。
2.4回放進度條：重播等，且可以自由設定開始播放和結束播放時間點。
2.5計算停駐點和轉彎點：在播放軌跡回放的同時計算並顯示當前農機工作經過的轉彎點和停駐點數量。

*/

/*      +++++ Find Key Turning Point +++++
/// C: cluster
/// TC: truning cluster
/// 前後加距離(直到向量變化率很小)可標示出轉彎區

// TC 的距離中點
// ( TC + 前後各 one C )的距離中點

// TC 中的兩大角的距離終點
// ( TC + 前後各 one C )的兩大角的距離終點

// 連續兩 TC 距離最遠的兩點
// 連續兩( TC + 前後各 one C )距離最遠的兩點

//   /   距離中點要是 path 上的 GPS point 還是要創造出來？
*/

/* Done List
1. feat(layout): put info plane & pogress bar on the map
2. fix: multiple polylines overlap

*/

/* Meeting
插植後4, 6筆還是怪
*/

//     //////////  Create the path on the map  //////////
localStorage.setItem("status", "true");
const LOCAL_STORAGE_DATA = localStorage.getItem("0");
const ROUTE = createRouteFromLocalStorage(LOCAL_STORAGE_DATA);
// const PATH = removeRouteOutliersAndInterpolate(ROUTE);
const PATH = ROUTE;
let MAP;
initMAP(PATH);
let GREY_PATH = createPolylinePath(PATH, 'grey', 0.38, 3, MAP, 0);
GREY_PATH.addListener('click', handlePolylineClick);
//     //////////  Create the tea harvester  //////////
const TEA_HARVESTER = {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 5,
    strokeColor: "Crimson",
    strokeOpacity: 1,
};
const TEA_LINE = new google.maps.Polyline({
    geodesic: true,
    icons: [
        {
            icon: TEA_HARVESTER,
            offset: "0%",
        },
    ],
    map: MAP,
    path: PATH,
    strokeOpacity: 0,
    strokeWeight: 3,
    zIndex: 1,
});
TEA_LINE.addListener('click', handlePolylineClick);
const PATH_POINTS_DISTANCE_LIST = computeLatLngObjectDistanceList(PATH);
const PATH_TOTAL_DISTANCE = PATH_POINTS_DISTANCE_LIST.reduce((acc, distance) => acc + distance, 0);
//     //////////  Create the speed color segments  //////////
let COLOR_SEGMENTS = [];
let theZIndex = 2;
for (let i = 0;  i < PATH_POINTS_DISTANCE_LIST.length;  ++i) {
    const currentSpeed = PATH_POINTS_DISTANCE_LIST[i];
    const speedColor = calculateColorBySpeed(currentSpeed);
    COLOR_SEGMENTS.push(createPolylineSegment(PATH[i], PATH[i+1], speedColor, 0, 3, MAP, theZIndex));
    ++theZIndex;
}
// Add click event listeners to each speed color segment
for (let i = 0; i < COLOR_SEGMENTS.length; i++) {
    COLOR_SEGMENTS[i].addListener('click', handlePolylineClick);
}
//     //////////  Highlight turning points  //////////
const DBC_LIST = DBC(PATH_POINTS_DISTANCE_LIST);
const TURNING_CLUSTER_INDEX_LIST = TRD(DBC_LIST);
const TURNING_POINT_LIST = TURNING_CLUSTER_INDEX_LIST.map(index =>
    findIndexMiddleLatLngObject(DBC_LIST[index])
);
// usePinHighlightGPSPointsOnMap(MAP, TURNING_POINT_LIST, "Midpoint of TRD cluster", 0.3, "blue", "white", "white");  // show all TRD points on PATH
console.log("Number of Midpoint of TRD cluster:", TURNING_POINT_LIST.length);
const KTP_LIST = findKTP(DBC_LIST, TURNING_CLUSTER_INDEX_LIST);
// usePinHighlightGPSPointsOnMap(MAP, KTP_LIST, "KTP point", 0.45, "Magenta", "Blue", "Yellow");  // show all TRD points on PATH
KTP_LIST.forEach(point => { 
    addDotMarkerOnMap(MAP, point, "KTP point", {
        width: '10px',
        height: '10px',
        backgroundColor: "Magenta",
        border: '2px solid Cyan',
        boxShadow: '0 0 8px rgba(0, 0, 0, 0.5)'
    });
});
//     //////////  init info init value  //////////
updateLatitudeLongitude();
updateAccumulateTime();
updateAccumulateDistance();
//     //////////  Speed color table  //////////
const TABLE_COLORS = [
    { value: '0', name: 'Red', class: 'color-red' },
    { value: '0.25', name: 'Orange', class: 'color-orange' },
    { value: '0.5', name: 'Yellow', class: 'color-yellow' },
    { value: '1', name: 'Green', class: 'color-green' },
    { value: '1.5', name: 'Cyan', class: 'color-cyan' },
    { value: '2', name: 'Blue', class: 'color-blue' },
    { value: '≥ 2.25', name: 'Purple', class: 'color-purple' },
];
const SPEED_COLOR_TABLE = document.getElementById('speedColorTable');
TABLE_COLORS.forEach(color => {
    const row = document.createElement('tr');
    row.className = color.class;
    
    const valueCell = document.createElement('td');
    valueCell.textContent = color.value;
  
    row.appendChild(valueCell);
    SPEED_COLOR_TABLE.appendChild(row);
});
//     //////////  Animation  //////////
document.getElementById("progressBar").max = PATH.length - 1;
document.getElementById("playPauseButton").addEventListener("click", togglePlayPause);
document.getElementById("progressBar").addEventListener("input", handleProgressBarDrag);
document.getElementById("progressBar").addEventListener("mousedown", handleProgressBarMouseDown);
document.getElementById("progressBar").addEventListener("mouseup", handleProgressBarMouseUp);
document.getElementById("replaySpeed").addEventListener("change", changeReplaySpeed);


//     //////////  show time when move over progeress bar  //////////

// const progressBar = document.getElementById('progressBar');
// const tooltip = document.getElementById('tooltip');
// Function to calculate the time value based on mouse position
function calculateTimeValue(mouseX, rect) {
    const percentage = mouseX / rect.width;     // Calculate percentage based on mouse position
    const maxValue = parseInt(progressBar.max); // Max value of the progress bar
    return Math.round(percentage * maxValue);   // Calculate the corresponding value based on percentage
}

// // Update the progress bar background and tooltip on mousemove
// progressBar.addEventListener('mousemove', function(event) {
//     const rect = this.getBoundingClientRect();  // Get the position of the progress bar
//     console.log("rect.width", rect.width);;;;;;;;;;;;;;;;;;;
//     let mouseX = event.clientX - rect.left;   // Mouse X relative to the bar

//     console.log("event.clientX:", event.clientX);;;;;;;;;;;;;;;;;
//     console.log("Math.round(rect.left):", Math.round(rect.left));;;;;;;;;;;;;;;;
//     console.log("event.clientX - Math.round(rect.left):", event.clientX - Math.round(rect.left));;;;;;;;;;;
//     // mouseX = event.clientX - Math.round(rect.left);;;;;;;;;;;;;
    
//     let currentValue = calculateTimeValue(mouseX, rect);  // Calculate the time value
//     if (currentValue < 0) {
//         currentValue = 0;
//     }
//     if (currentValue > this.max) {
//         currentValue = this.max;
//     }
//     const timing = convertSeconds(currentValue);  // Convert to time format

//     console.log("currentValue:", currentValue);;;;;;;;;;;;
//     console.log("timing:", timing);;;;;;;;;;;;
//     console.log("<><><><><><><><><><><><><><><><>");;;;;;;;;;;;
    
//     tooltip.innerHTML = timing;  // Update the tooltip content
    
//     // Show the tooltip and position it
//     tooltip.style.display = 'block';
//     let tooltipX = mouseX - tooltip.offsetWidth / 2;  // Center the tooltip over the mouse
    
//     // Ensure tooltip doesn't go off screen (left and right bounds)
//     if (tooltipX < 0) {
//         tooltipX = 0;
//     }
//     if (tooltipX + tooltip.offsetWidth > rect.width) {
//         tooltipX = rect.width - tooltip.offsetWidth;
//     }
//     tooltip.style.left = `${tooltipX}px`;
// });

// // // Update the progress value when clicking on the progress bar
// // progressBar.addEventListener('click', function(event) {
// //     const rect = this.getBoundingClientRect();  // Get the position of the progress bar
// //     const mouseX = event.clientX - rect.left;   // Mouse X relative to the bar
    
// //     const currentValue = calculateTimeValue(mouseX, rect);  // Calculate the time value
// //     this.value = currentValue;  // Update the progress bar value
    
// //     // Optionally, you can perform an action here based on the updated value
// //     console.log("Updated progress bar value:", currentValue);
// // });

// // Hide tooltip when mouse leaves the progress bar
// progressBar.addEventListener('mouseleave', function() {
//     tooltip.style.display = 'none';
// });

// Trigger input event to simulate a click
progressBar.addEventListener('input', function() {
    const rect = this.getBoundingClientRect();  // Get the position of the progress bar
    const mouseX = (this.value / this.max) * rect.width;  // Calculate mouse X based on value

    const currentValue = calculateTimeValue(mouseX, rect);  // Calculate the time value
    console.log("Simulated click, accurate progress bar value:", currentValue);

    // Optional: update the tooltip content or any other logic
});
// Trigger change event to simulate final click
progressBar.addEventListener('change', function() {
    const rect = this.getBoundingClientRect();  // Get the position of the progress bar
    const mouseX = (this.value / this.max) * rect.width;  // Calculate mouse X based on value

    const currentValue = calculateTimeValue(mouseX, rect);  // Calculate the time value
    console.log("Simulated final click, accurate progress bar value:", currentValue);

    // Optional: update the tooltip content or any other logic
});
