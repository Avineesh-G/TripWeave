package com.tripweave.app.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tripweave.app.ui.MainViewModel
import com.tripweave.core.designsystem.components.ConfidenceChip
import com.tripweave.core.designsystem.components.FeasibilityPill
import com.tripweave.core.designsystem.R
import com.tripweave.core.model.FeasibilityLevel
import com.tripweave.core.model.PriceSourceType
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MapHomeScreen(
    viewModel: MainViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    var selectedFilter by remember { mutableStateOf("All") }
    var isAddStopOpen by remember { mutableStateOf(false) }

    Box(modifier = modifier.fillMaxSize()) {
        // 1. Map Canvas with visual route polyline and stop pins
        MapCanvas(
            stops = uiState.stops,
            onStopClick = { viewModel.openStopDetail(it) },
            modifier = Modifier.fillMaxSize()
        )

        // 2. Top Floating Controls
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 16.dp, start = 16.dp, end = 16.dp)
        ) {
            // Search & Feasibility Bar
            Surface(
                shape = RoundedCornerShape(28.dp),
                color = MaterialTheme.colorScheme.surface,
                tonalElevation = 4.dp,
                shadowElevation = 6.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = "Search",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = uiState.activeTrip?.destinationName?.let {
                            stringResource(R.string.active_trip_chip, it)
                        } ?: stringResource(R.string.search_places_hint),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(1f)
                    )

                    // Feasibility Pill
                    uiState.feasibilityReport?.let { report ->
                        val label = when (report.overallFeasibility) {
                            FeasibilityLevel.FEASIBLE -> stringResource(R.string.feasibility_feasible)
                            FeasibilityLevel.TIGHT -> stringResource(R.string.feasibility_tight)
                            FeasibilityLevel.INFEASIBLE -> stringResource(R.string.feasibility_infeasible)
                        }
                        FeasibilityPill(
                            feasibilityLevel = report.overallFeasibility,
                            timePercent = report.timeUsedPercent,
                            budgetPercent = report.budgetUsedPercent,
                            label = label
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Filter Chips Row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = selectedFilter == "Attractions",
                    onClick = { selectedFilter = "Attractions" },
                    label = { Text(stringResource(R.string.filter_attractions)) }
                )
                FilterChip(
                    selected = selectedFilter == "Food",
                    onClick = { selectedFilter = "Food" },
                    label = { Text(stringResource(R.string.filter_food)) }
                )
                FilterChip(
                    selected = selectedFilter == "Fuel",
                    onClick = { selectedFilter = "Fuel" },
                    label = { Text(stringResource(R.string.filter_fuel)) }
                )
                FilterChip(
                    selected = selectedFilter == "Stays",
                    onClick = { selectedFilter = "Stays" },
                    label = { Text(stringResource(R.string.filter_stays)) }
                )
                ConfidenceChip(
                    sourceType = PriceSourceType.DEMO,
                    modifier = Modifier.align(Alignment.CenterVertically)
                )
            }
        }

        // 3. Floating Action Button: Add Stop
        FloatingActionButton(
            onClick = { isAddStopOpen = true },
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 20.dp, bottom = 110.dp)
        ) {
            Icon(Icons.Default.Add, contentDescription = stringResource(R.string.action_add_stop))
        }

        // 4. Bottom Draggable Peek Sheet
        Surface(
            shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 6.dp,
            shadowElevation = 8.dp,
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .padding(bottom = 0.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp)
            ) {
                // Drag handle bar
                Box(
                    modifier = Modifier
                        .size(width = 36.dp, height = 4.dp)
                        .background(Color.Gray.copy(alpha = 0.4f), RoundedCornerShape(2.dp))
                        .align(Alignment.CenterHorizontally)
                )
                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        val nextStop = uiState.stops.firstOrNull { it.stopOrder > 0 }
                        Text(
                            text = nextStop?.let { "Next: ${it.name}" } ?: "Plan Stops",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        uiState.scheduleResult?.let { sched ->
                            Text(
                                text = "Total travel: ${sched.totalTravelMinutes} min • ${uiState.stops.size} stops",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    uiState.budgetResult?.let { budget ->
                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                text = "₹${budget.totalCost.roundToInt()}",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Text(
                                text = "of ₹${uiState.activeTrip?.totalBudget?.roundToInt() ?: 0}",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }

    // Add Stop Quick Sheet
    if (isAddStopOpen) {
        AddStopDialog(
            onDismiss = { isAddStopOpen = false },
            onAdd = { name, duration, buffer ->
                // Add stop along the route
                viewModel.addStopToActiveTrip(name, 12.42, 75.73, duration, buffer)
                isAddStopOpen = false
            }
        )
    }
}

@Composable
fun MapCanvas(
    stops: List<com.tripweave.core.model.TripStop>,
    onStopClick: (com.tripweave.core.model.TripStop) -> Unit,
    modifier: Modifier = Modifier
) {
    Box(modifier = modifier.background(Color(0xFFE8ECEF))) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            if (stops.size >= 2) {
                val path = Path()
                val stepY = size.height / (stops.size + 1)
                val centerX = size.width / 2

                for (i in stops.indices) {
                    val x = centerX + if (i % 2 == 0) -60f else 60f
                    val y = (i + 1) * stepY
                    if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
                }

                // Draw scenic highway route line
                drawPath(
                    path = path,
                    color = Color(0xFF0F4C5C),
                    style = Stroke(width = 8f)
                )
            }
        }

        // Render Stop Pins
        val stepWeight = 1f / (stops.size + 1).coerceAtLeast(1)
        for ((index, stop) in stops.withIndex()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(
                        top = ((index + 1) * 110).dp,
                        start = (if (index % 2 == 0) 60 else 180).dp
                    )
            ) {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.surface,
                    shadowElevation = 4.dp,
                    modifier = Modifier.clickable { onStopClick(stop) }
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp)
                    ) {
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier
                                .size(24.dp)
                                .background(MaterialTheme.colorScheme.primary, CircleShape)
                        ) {
                            Text(
                                text = "${index + 1}",
                                color = Color.White,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = stop.name.take(18) + if (stop.name.length > 18) "..." else "",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun AddStopDialog(
    onDismiss: () -> Unit,
    onAdd: (name: String, duration: Int, buffer: Int) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var duration by remember { mutableStateOf(60) }
    var buffer by remember { mutableStateOf(15) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Custom Stop") },
        text = {
            Column {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Stop Name (e.g. Cafe, Viewpoint)") },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Visit Duration: ${duration}m")
                    Row {
                        FilledTonalButton(onClick = { if (duration > 15) duration -= 15 }) { Text("-") }
                        Spacer(modifier = Modifier.width(4.dp))
                        FilledTonalButton(onClick = { duration += 15 }) { Text("+") }
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Buffer: ${buffer}m")
                    Row {
                        FilledTonalButton(onClick = { if (buffer > 5) buffer -= 5 }) { Text("-") }
                        Spacer(modifier = Modifier.width(4.dp))
                        FilledTonalButton(onClick = { buffer += 5 }) { Text("+") }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { if (name.isNotBlank()) onAdd(name, duration, buffer) },
                enabled = name.isNotBlank()
            ) {
                Text("Add to Trip")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
