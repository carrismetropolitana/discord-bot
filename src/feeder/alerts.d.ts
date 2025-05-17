export interface Alert {
	active_period: ActivePeriod[]
	alert_id: string
	cause: string
	description_text: DescriptionText
	effect: string
	header_text: DescriptionText
	image: Image | null
	informed_entity: InformedEntity[]
	url: DescriptionText
}

export interface ActivePeriod {
	end?: number
	start: number
}

export interface DescriptionText {
	translation: Translation[]
}

export interface Translation {
	language: string
	text: string
}

export interface Image {
	localizedImage: LocalizedImage[]
}

export interface LocalizedImage {
	language: string
	media_type: string
	url: string
}

export interface InformedEntity {
	route_id: string
	stop_id?: string
}
