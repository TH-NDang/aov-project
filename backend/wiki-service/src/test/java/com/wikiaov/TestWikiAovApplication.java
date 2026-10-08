package com.wikiaov;

import org.springframework.boot.SpringApplication;

public class TestWikiAovApplication {

	public static void main(String[] args) {
		SpringApplication.from(WikiAovApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
