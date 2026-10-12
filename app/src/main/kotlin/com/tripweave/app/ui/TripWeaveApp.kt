package com.tripweave.app.ui

import android.content.res.Configuration
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tripweave.app.ui.screens.*
import com.tripweave.core.designsystem.R
import com.tripweave.core.designsystem.theme.TripWeaveTheme
import java.util.Locale

@Composable
fun TripWeaveApp(
    viewModel: MainViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    // Multilingual locale override support
    val configuration = LocalConfiguration.current
    val currentLocale = Locale(uiState.currentLanguage)
    val localizedConfiguration = remember(uiState.currentLanguage) {
        Configuration(configuration).apply {
            setLocale(currentLocale)
        }
    }

    CompositionLocalProvider(
        LocalConfiguration provides localizedConfiguration
    ) {
        TripWeaveTheme {
            Scaffold(
                bottomBar = {
                    NavigationBar {
                        NavigationBarItem(
                            selected = uiState.selectedTab == AppTab.MAP,
                            onClick = { viewModel.selectTab(AppTab.MAP) },
                            icon = { Icon(Icons.Default.Map, contentDescription = stringResource(R.string.nav_map)) },
                            label = { Text(stringResource(R.string.nav_map)) }
                        )
                        NavigationBarItem(
                            selected = uiState.selectedTab == AppTab.ITINERARY,
                            onClick = { viewModel.selectTab(AppTab.ITINERARY) },
                            icon = { Icon(Icons.Default.Timeline, contentDescription = stringResource(R.string.nav_itinerary)) },
                            label = { Text(stringResource(R.string.nav_itinerary)) }
                        )
                        NavigationBarItem(
                            selected = uiState.selectedTab == AppTab.BUDGET,
                            onClick = { viewModel.selectTab(AppTab.BUDGET) },
                            icon = { Icon(Icons.Default.AccountBalanceWallet, contentDescription = stringResource(R.string.nav_budget)) },
                            label = { Text(stringResource(R.string.nav_budget)) }
                        )
                        NavigationBarItem(
                            selected = uiState.selectedTab == AppTab.TRIPS,
                            onClick = { viewModel.selectTab(AppTab.TRIPS) },
                            icon = { Icon(Icons.Default.CardTravel, contentDescription = stringResource(R.string.nav_trips)) },
                            label = { Text(stringResource(R.string.nav_trips)) }
                        )
                        NavigationBarItem(
                            selected = uiState.selectedTab == AppTab.SETTINGS,
                            onClick = { viewModel.selectTab(AppTab.SETTINGS) },
                            icon = { Icon(Icons.Default.Settings, contentDescription = stringResource(R.string.nav_settings)) },
                            label = { Text(stringResource(R.string.nav_settings)) }
                        )
                    }
                }
            ) { innerPadding ->
                val modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)

                when (uiState.selectedTab) {
                    AppTab.MAP -> MapHomeScreen(viewModel = viewModel, modifier = modifier)
                    AppTab.ITINERARY -> ItineraryScreen(viewModel = viewModel, modifier = modifier)
                    AppTab.BUDGET -> BudgetScreen(viewModel = viewModel, modifier = modifier)
                    AppTab.TRIPS -> TripsScreen(viewModel = viewModel, modifier = modifier)
                    AppTab.SETTINGS -> SettingsScreen(viewModel = viewModel, modifier = modifier)
                }

                if (uiState.isCreateTripOpen) {
                    CreateTripDialog(
                        onDismiss = { viewModel.setCreateTripOpen(false) },
                        onCreate = { title, dest, dep, bud, grp, mil, fuel ->
                            viewModel.createNewTrip(title, dest, dep, bud, grp, mil, fuel)
                        }
                    )
                }

                uiState.selectedStopForDetail?.let { stop ->
                    StopDetailSheet(
                        stop = stop,
                        viewModel = viewModel,
                        onDismiss = { viewModel.openStopDetail(null) }
                    )
                }
            }
        }
    }
}
