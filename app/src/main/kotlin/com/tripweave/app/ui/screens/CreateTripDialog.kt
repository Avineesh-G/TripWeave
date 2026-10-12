package com.tripweave.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.tripweave.core.designsystem.R

@Composable
fun CreateTripDialog(
    onDismiss: () -> Unit,
    onCreate: (title: String, destination: String, departureMinutes: Int, budget: Double, groupSize: Int, mileage: Double, fuelPrice: Double) -> Unit
) {
    var step by remember { mutableStateOf(1) }

    var title by remember { mutableStateOf("") }
    var destination by remember { mutableStateOf("") }
    var departureMinutes by remember { mutableStateOf(360) } // 06:00 AM
    var budget by remember { mutableStateOf("12000") }
    var groupSize by remember { mutableStateOf("4") }
    var mileage by remember { mutableStateOf("16.0") }
    var fuelPrice by remember { mutableStateOf("102.5") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text("Create Trip - Step $step of 5")
        },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                when (step) {
                    1 -> {
                        Text("Step 1: Route & Destination", style = MaterialTheme.typography.titleSmall)
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = title,
                            onValueChange = { title = it },
                            label = { Text("Trip Title (e.g. Hampi Weekend)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = destination,
                            onValueChange = { destination = it },
                            label = { Text("Destination City/Region") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                    2 -> {
                        Text("Step 2: Departure Schedule", style = MaterialTheme.typography.titleSmall)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Departure Time: ${departureMinutes / 60}:00 AM")
                        Slider(
                            value = departureMinutes.toFloat(),
                            onValueChange = { departureMinutes = it.toInt() },
                            valueRange = 300f..720f,
                            steps = 6
                        )
                    }
                    3 -> {
                        Text("Step 3: Group & Vehicle", style = MaterialTheme.typography.titleSmall)
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = groupSize,
                            onValueChange = { groupSize = it },
                            label = { Text("Travelers (Group Size)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = mileage,
                            onValueChange = { mileage = it },
                            label = { Text("Mileage (km/L)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                    4 -> {
                        Text("Step 4: Planned Budget", style = MaterialTheme.typography.titleSmall)
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = budget,
                            onValueChange = { budget = it },
                            label = { Text("Total Trip Budget (₹)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                    5 -> {
                        Text("Step 5: Review Summary", style = MaterialTheme.typography.titleSmall)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Trip: $title to $destination")
                        Text("Budget: ₹$budget for $groupSize people")
                        Text("Departure: ${departureMinutes / 60}:00 AM")
                    }
                }
            }
        },
        confirmButton = {
            if (step < 5) {
                Button(
                    onClick = { step++ },
                    enabled = (step != 1 || (title.isNotBlank() && destination.isNotBlank()))
                ) {
                    Text("Next")
                }
            } else {
                Button(
                    onClick = {
                        onCreate(
                            title,
                            destination,
                            departureMinutes,
                            budget.toDoubleOrNull() ?: 10000.0,
                            groupSize.toIntOrNull() ?: 2,
                            mileage.toDoubleOrNull() ?: 15.0,
                            fuelPrice.toDoubleOrNull() ?: 100.0
                        )
                    }
                ) {
                    Text("Create Trip")
                }
            }
        },
        dismissButton = {
            if (step > 1) {
                TextButton(onClick = { step-- }) { Text("Back") }
            } else {
                TextButton(onClick = onDismiss) { Text("Cancel") }
            }
        }
    )
}
