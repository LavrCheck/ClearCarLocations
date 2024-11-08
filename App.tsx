import React, {useEffect, useState} from 'react';
import {Alert, Button, StyleSheet, Text, TextInput, View} from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import {StatusBar} from "expo-status-bar";

const LOCATION_TASK = 'background-location-task'

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
    }),
});

export default function App() {
    const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null)
    const [url, setUrl] = useState<string>('')

    TaskManager.defineTask(LOCATION_TASK, async ({data, error}) => {
        if (error) {
            console.error("Ошибка фоновой задачи локации:", error)
            return
        }

        if (data) {
            const {locations} = data as { locations: Location.LocationObject[] }
            const location = locations[0]
            if (location) {
                setLocation(location.coords)
                await sendLocationToServer(location.coords)
            }
        }
    });

    useEffect(() => {

        (async () => {
            const notification = await Notifications.requestPermissionsAsync();
            if (notification.status !== 'granted') {
                Alert.alert('Разрешение на отправку уведомлений отклонено')
            }

            const foregroundPermissions = await Location.requestForegroundPermissionsAsync()
            if (foregroundPermissions.status !== 'granted') {
                Alert.alert('Разрешение на доступ к локации отклонено')
                return
            }

            const backgroundPermissions = await Location.requestBackgroundPermissionsAsync()
            if (backgroundPermissions.status !== 'granted') {
                Alert.alert('Разрешение на фоновое отслеживание местоположения отклонено')
                return
            }

            const location = await Location.getCurrentPositionAsync({})
            setLocation(location.coords)

            await Location.startLocationUpdatesAsync(LOCATION_TASK, {
                accuracy: Location.Accuracy.High,
                distanceInterval: 100,
                deferredUpdatesInterval: 1000,
                showsBackgroundLocationIndicator: true,
            })
        })()
    }, [])

    const updateLocation = async (): Promise<void> => {
        const {status} = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') {
            Alert.alert('Разрешение на доступ к локации отклонено')
            return
        }
        const location = await Location.getCurrentPositionAsync({})
        setLocation(location.coords)
        await sendLocationToServer(location.coords);
    };

    const sendLocationToServer = async (coords: Location.LocationObjectCoords): Promise<void> => {
        if (!url) {
            await sendNotification('URL не введен', 'Локация не отправленна на сервер')
            return
        }
        try {
            await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({latitude: coords.latitude, longitude: coords.longitude}),
            });
            await sendNotification('Успешно', 'Локация отправленна на сервер')
        } catch (error) {
            await sendNotification('Ошибка отправки на сервер', 'Проверьте URL')
            console.error("Ошибка отправки данных на сервер:", error);
        }
    }

    const sendNotification = async (title: string, body: string): Promise<void> => {
        await Notifications.scheduleNotificationAsync({
            content: {title, body},
            trigger: null,
        })
    }

    return (
        <View style={styles.container}>
            <StatusBar style='dark'/>
            <Text style={styles.header}>Отслеживание локации</Text>
            <TextInput
                style={styles.input}
                placeholder="URL сервера"
                value={url}
                onChangeText={setUrl}
            />
            <Button title="Подтвердить и отправить" onPress={updateLocation}/>
            <Text style={styles.locationText}>Текущая локация</Text>
            <Text style={styles.locationText}>Широта: {location?.latitude ?? 'Неизвестна'}</Text>
            <Text style={styles.locationText}>Долгота: {location?.longitude ?? 'Неизвестна'}</Text>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#fff'
    },
    header: {
        fontSize: 24,
        textAlign: 'center',
        marginBottom: 20
    },
    input: {
        borderWidth: 1,
        padding: 10,
        marginBottom: 10,
        borderRadius: 5
    },
    locationText: {
        marginTop: 20,
        textAlign: 'center'
    },
})