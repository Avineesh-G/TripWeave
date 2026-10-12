package com.tripweave.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tripweave.app.ui.MainViewModel
import com.tripweave.core.designsystem.R
import com.tripweave.core.designsystem.components.TimelineSpine
import com.tripweave.core.model.OpeningStatus
import com.tripweave.core.model.ScheduledStop
import com.tripweave.core.model.TripStop

@Composable
fun ItineraryScreen(
    viewModel: MainViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val scheduledStops = uiState.scheduleResult?.stops ?: emptyList()

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = uiState.activeTrip?.title ?: stringResource(R.string.nav_itinerary),
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "${scheduledStops.size} Stops • Recalculates dynamically",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (scheduledStops.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text("No stops added yet. Tap Add Stop on the map!")
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                itemsIndexed(scheduledStops) { index, item ->
                    ScheduledStopCard(
                        scheduledStop = item,
                        index = index,
                        totalStops = scheduledStops.size,
                        onMoveUp = { viewModel.moveStop(index, index - 1) },
                        onMoveDown = { viewModel.moveStop(index, index + 1) },
                        onDurationChange = { delta -> viewModel.updateStopDuration(item.stop, delta) },
                        onBufferChange = { delta -> viewModel.updateStopBuffer(item.stop, delta) },
                        onDelete = { viewModel.deleteStop(item.stop.id) },
                        onClick = { viewModel.openStopDetail(item.stop) }
                    )

                    if (index < scheduledStops.size - 1) {
                        val next = scheduledStops[index + 1]
                        TimelineConnector(
                            travelMinutes = next.travelDurationFromPreviousMinutes,
                            distanceKm = next.distanceFromPreviousKm
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ScheduledStopCard(
    scheduledStop: ScheduledStop,
    index: Int,
    totalStops: Int,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    onDurationChange: (Int) -> Unit,
    onBufferChange: (Int) -> Unit,
    onDelete: () -> Unit,
    onClick: () -> Unit
) {
    val stop = scheduledStop.stop

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        tonalElevation = 2.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            // Header with Stop Order & Timing
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = MaterialTheme.colorScheme.primary
                    ) {
                        Text(
                            text = "#${index + 1}",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = stop.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                // Up / Down Reorder buttons
                Row {
                    if (index > 0) {
                        IconButton(onClick = onMoveUp, modifier = Modifier.size(28.dp)) {
                            Icon(Icons.Default.KeyboardArrowUp, contentDescription = "Move Up")
                        }
                    }
                    if (index < totalStops - 1) {
                        IconButton(onClick = onMoveDown, modifier = Modifier.size(28.dp)) {
                            Icon(Icons.Default.KeyboardArrowDown, contentDescription = "Move Down")
                        }
                    }
                    IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
                        Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error)
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Time & Buffer Chips
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                AssistChip(
                    onClick = {},
                    label = { Text("Arr: ${formatTime(scheduledStop.arrivalMinutes)}") }
                )
                AssistChip(
                    onClick = {},
                    label = { Text("Dep: ${formatTime(scheduledStop.departureMinutes)}") }
                )

                // Opening status chip
                when (scheduledStop.openingStatus) {
                    OpeningStatus.CLOSED_ON_ARRIVAL -> {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Color(0xFFFFDCD0)
                        ) {
                            Text(
                                text = "Closed on Arrival",
                                color = Color(0xFFC2410C),
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 4.dp)
                            )
                        }
                    }
                    OpeningStatus.TIGHT_CLOSING -> {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Color(0xFFFEE7C8)
                        ) {
                            Text(
                                text = "Tight Closing",
                                color = Color(0xFFD97706),
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 4.dp)
                            )
                        }
                    }
                    else -> {}
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Steppers for Visit Duration and Buffer
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Visit: ${stop.plannedDurationMinutes}m", style = MaterialTheme.typography.bodySmall)
                    Spacer(modifier = Modifier.width(4.dp))
                    FilledTonalButton(
                        onClick = { onDurationChange(-15) },
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp),
                        modifier = Modifier.height(28.dp)
                    ) { Text("-15m", fontSize = 11.sp) }
                    Spacer(modifier = Modifier.width(4.dp))
                    FilledTonalButton(
                        onClick = { onDurationChange(15) },
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp),
                        modifier = Modifier.height(28.dp)
                    ) { Text("+15m", fontSize = 11.sp) }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Buffer: ${stop.bufferMinutes}m", style = MaterialTheme.typography.bodySmall)
                    Spacer(modifier = Modifier.width(4.dp))
                    FilledTonalButton(
                        onClick = { onBufferChange(5) },
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp),
                        modifier = Modifier.height(28.dp)
                    ) { Text("+5m", fontSize = 11.sp) }
                }
            }
        }
    }
}

@Composable
fun TimelineConnector(
    travelMinutes: Int,
    distanceKm: Double
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(vertical = 4.dp, horizontal = 16.dp)
    ) {
        TimelineSpine(travelDurationMinutes = travelMinutes, distanceKm = distanceKm)
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = "Travel: ${travelMinutes} min (${distanceKm.toInt()} km)",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

private fun formatTime(minutes: Int): String {
    val norm = minutes % 1440
    val h = norm / 60
    val m = norm % 60
    val amPm = if (h >= 12) "PM" else "AM"
    val h12 = if (h == 0) 12 else if (h > 12) h - 12 else h
    return String.format("%02d:%02d %s", h12, m, amPm)
}
